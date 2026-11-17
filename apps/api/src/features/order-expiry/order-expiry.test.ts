import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  addresses,
  createDb,
  orders,
  menuCategories,
  menuItems,
  orderSettings,
  sessions,
  stores,
  storeStaffMemberships,
  users,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { type PaymentIntent, type StripeClient } from '../../integrations/stripe/client';
import { createOrderService } from '../orders/orders.service';
import { createStoreOrderService } from '../store-orders/store-orders.service';
import { createOrderExpiryService } from './order-expiry.service';
import { createOrderExpiryRepository } from './order-expiry.repository';
import type { CheckoutInput } from '../orders/orders.schema';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/food_delivery_test')
  throw new Error('Dedicated TEST_DATABASE_URL required');
const db = createDb(url);
let intents: Map<string, PaymentIntent>;
let createKeys: Map<string, string>;
const stripe = {
  create: vi.fn<StripeClient['create']>(),
  retrieve: vi.fn<StripeClient['retrieve']>(),
  confirm: vi.fn<StripeClient['confirm']>(),
  capture: vi.fn<StripeClient['capture']>(),
  cancel: vi.fn<StripeClient['cancel']>(),
};
let userId: string;
let input: CheckoutInput;
let key: string;
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
});
afterAll(async () => {
  await db.execute(sql`truncate stores, users cascade`);
  await db.$client.end();
});
beforeEach(async () => {
  vi.resetAllMocks();
  await db.execute(sql`truncate stores, users cascade`);
  await db.update(orderSettings).set({ deliveryFee: 300 }).where(eq(orderSettings.id, 1));
  intents = new Map();
  createKeys = new Map();
  stripe.create.mockImplementation((amount, _pm, operationKey) => {
    const previous = createKeys.get(operationKey);
    if (previous) return Promise.resolve({ ...intents.get(previous)! });
    const id = `pi_${randomUUID().replaceAll('-', '')}`;
    const intent = {
      id,
      amount,
      amount_capturable: 0,
      currency: 'jpy',
      capture_method: 'manual',
      status: 'requires_confirmation',
    };
    intents.set(id, intent);
    createKeys.set(operationKey, id);
    return Promise.resolve({ ...intent });
  });
  stripe.retrieve.mockImplementation((id) => Promise.resolve({ ...intents.get(id)! }));
  stripe.confirm.mockImplementation((id) => {
    const intent = intents.get(id)!;
    intent.status = 'requires_capture';
    intent.amount_capturable = intent.amount;
    return Promise.resolve({ ...intent });
  });
  stripe.cancel.mockImplementation((id) => {
    const intent = intents.get(id)!;
    intent.status = 'canceled';
    intent.amount_capturable = 0;
    return Promise.resolve({ ...intent });
  });
  userId = randomUUID();
  key = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: 'Customer',
    email: `${userId}@example.test`,
    emailVerified: true,
    phoneNumber: '09012345678',
  });
  const token = randomUUID();
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId, token, expiresAt: new Date(Date.now() + 3600000) });

  const [store] = await db
    .insert(stores)
    .values({ name: 'Store', address: 'Tokyo', latitude: 35, longitude: 139 })
    .returning();
  const [address] = await db
    .insert(addresses)
    .values({
      userId,
      address: 'Home',
      building: '101',
      deliveryNote: '入口',
      latitude: 35.001,
      longitude: 139,
    })
    .returning();
  const [category] = await db
    .insert(menuCategories)
    .values({ storeId: store!.id, name: 'Menu' })
    .returning();
  const [item] = await db
    .insert(menuItems)
    .values({ storeId: store!.id, categoryId: category!.id, name: 'Curry', price: 700 })
    .returning();
  input = {
    storeId: store!.id,
    addressId: address!.id,
    items: [{ menuItemId: item!.id, quantity: 2 }],
    fulfillment: 'hand_delivery',
    paymentMethodId: 'pm_fake',
  };
});

async function storeFixture() {
  const order = await createOrderService(db, stripe).checkout(userId, key, input);
  if ('clientSecret' in order) throw new Error('Unexpected action required');
  await db.update(orders).set({ createdAt: order.createdAt }).where(eq(orders.id, order.id));
  const staffId = randomUUID();
  await db.insert(users).values({
    id: staffId,
    name: '架空店舗スタッフ',
    email: `${staffId}@example.test`,
    phoneNumber: '09000000000',
    role: 'store',
    emailVerified: true,
  });
  await db.insert(storeStaffMemberships).values({ userId: staffId, storeId: input.storeId });
  stripe.capture.mockImplementation((id) => {
    const intent = intents.get(id)!;
    intent.status = 'succeeded';
    intent.amount_received = intent.amount;
    intent.amount_capturable = 0;
    return Promise.resolve({ ...intent });
  });
  return { order, staffId, service: createStoreOrderService(db, stripe) };
}

function expiry(at: Date, repository = createOrderExpiryRepository(db)) {
  return createOrderExpiryService(db, stripe, repository, () => at);
}
async function saved(id: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row!;
}
it('R-06 cancels at the exact deadline, skips before it and never cancels twice across workers', async () => {
  const { order } = await storeFixture();
  const deadline = new Date(order.createdAt.getTime() + 600000);
  await expiry(new Date(deadline.getTime() - 1)).run();
  expect(stripe.cancel).not.toHaveBeenCalled();
  await Promise.all([expiry(deadline).run(), expiry(deadline).run()]);
  expect(await saved(order.id)).toMatchObject({
    status: 'canceled',
    cancellationReason: 'expired',
    paymentVoidedAt: deadline,
  });
  expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(
    order.paymentIntentId,
    `${order.id}:expiry`,
  );
  await expiry(deadline).run();
  expect(stripe.cancel).toHaveBeenCalledOnce();
});
it('R-06 reserves cancellation before external failure and reconciles after restart', async () => {
  const { order } = await storeFixture();
  const deadline = new Date(order.createdAt.getTime() + 600000);
  const cancel = stripe.cancel.getMockImplementation()!;
  stripe.cancel.mockImplementationOnce(async (...args) => {
    await cancel(...args);
    throw new Error('lost response');
  });
  expect(await expiry(deadline).run()).toEqual({ completed: 0, failed: 1 });
  expect(await saved(order.id)).toMatchObject({
    status: 'canceled',
    cancellationReason: 'expired',
    paymentVoidedAt: null,
  });
  expect(await expiry(deadline).run()).toEqual({ completed: 1, failed: 0 });
  expect(stripe.cancel).toHaveBeenCalledOnce();
});
it('R-06 retries an external cancellation failure with the same key', async () => {
  const { order } = await storeFixture();
  const deadline = new Date(order.createdAt.getTime() + 600000);
  stripe.cancel.mockRejectedValueOnce(new Error('unavailable'));
  expect((await expiry(deadline).run()).failed).toBe(1);
  expect((await expiry(deadline).run()).completed).toBe(1);
  expect(stripe.cancel.mock.calls.map((call) => call[1])).toEqual([
    `${order.id}:expiry`,
    `${order.id}:expiry`,
  ]);
});
it('R-06 reconciles a DB failure after cancellation without repeating the external operation', async () => {
  const { order } = await storeFixture();
  const deadline = new Date(order.createdAt.getTime() + 600000);
  const repository = createOrderExpiryRepository(db);
  const faulty = {
    ...repository,
    update: vi.fn<typeof repository.update>().mockImplementation(async (...args) => {
      if (args[2].paymentVoidedAt) throw new Error('DB failure');
      await repository.update(...args);
    }),
  };
  expect((await expiry(deadline, faulty).run()).failed).toBe(1);
  expect((await expiry(deadline).run()).completed).toBe(1);
  expect(stripe.cancel).toHaveBeenCalledOnce();
});
it('R-06 skips unknown captures and allows F-10 reconciliation after the deadline', async () => {
  const { order, staffId, service } = await storeFixture();
  const capture = stripe.capture.getMockImplementation()!;
  stripe.capture.mockImplementationOnce(async (...args) => {
    await capture(...args);
    throw new Error('lost response');
  });
  await expect(service.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
    code: 'PAYMENT_RECONCILIATION_REQUIRED',
  });
  const deadline = new Date(order.createdAt.getTime() + 600000);
  await expiry(deadline).run();
  expect(stripe.cancel).not.toHaveBeenCalled();
  expect(
    (
      await createStoreOrderService(db, stripe, undefined, () => deadline).action(
        staffId,
        input.storeId,
        order.id,
        'accept',
      )
    ).status,
  ).toBe('preparing');
  expect(stripe.capture).toHaveBeenCalledOnce();
});
it('R-06 rechecks state under lock when acceptance wins after candidate selection', async () => {
  const { order, staffId, service } = await storeFixture();
  const repository = createOrderExpiryRepository(db);
  const candidates = vi
    .fn<typeof repository.candidates>()
    .mockImplementationOnce(async (...args) => {
      const rows = await repository.candidates(...args);
      await service.action(staffId, input.storeId, order.id, 'accept');
      return rows;
    })
    .mockImplementation((...args) => repository.candidates(...args));
  await expiry(new Date(order.createdAt.getTime() + 600000), { ...repository, candidates }).run();
  expect((await saved(order.id)).status).toBe('preparing');
  expect(stripe.cancel).not.toHaveBeenCalled();
});
it('R-06 does not void inconsistent or captured payments and continues with other orders', async () => {
  const { order } = await storeFixture();
  key = randomUUID();
  const second = await createOrderService(db, stripe).checkout(userId, key, input);
  if ('clientSecret' in second) throw new Error('Unexpected action required');
  await db.update(orders).set({ createdAt: second.createdAt }).where(eq(orders.id, second.id));
  intents.get(order.paymentIntentId)!.currency = 'usd';
  const deadline = new Date(
    Math.max(order.createdAt.getTime(), second.createdAt.getTime()) + 600000,
  );
  expect(await expiry(deadline).run()).toEqual({ completed: 1, failed: 1 });
  expect((await saved(order.id)).paymentVoidedAt).toBeNull();
  expect((await saved(second.id)).paymentVoidedAt).not.toBeNull();
  const intent = intents.get(order.paymentIntentId)!;
  intent.currency = 'jpy';
  intent.status = 'succeeded';
  intent.amount_capturable = 0;
  expect((await expiry(deadline).run()).failed).toBe(1);
  expect(stripe.cancel).toHaveBeenCalledOnce();
});
it('R-06 leaves store rejection reconciliation to the existing flow', async () => {
  const { order, staffId, service } = await storeFixture();
  await service.action(staffId, input.storeId, order.id, 'reject');
  stripe.retrieve.mockClear();
  await expiry(new Date(order.createdAt.getTime() + 600000)).run();
  expect(stripe.retrieve).not.toHaveBeenCalled();
  expect((await saved(order.id)).cancellationReason).toBe('store_rejected');
});
