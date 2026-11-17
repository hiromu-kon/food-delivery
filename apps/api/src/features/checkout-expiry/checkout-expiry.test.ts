import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  addresses,
  createDb,
  orders,
  checkoutAttempts,
  menuCategories,
  menuItems,
  orderSettings,
  sessions,
  stores,
  users,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { type PaymentIntent, type StripeClient } from '../../integrations/stripe/client';
import { createOrderService } from '../orders/orders.service';
import { createCheckoutExpiryService } from './checkout-expiry.service';
import { createCheckoutExpiryRepository } from './checkout-expiry.repository';
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
      status: 'requires_action',
      livemode: false,
      confirmation_method: 'automatic',
      client_secret: `${id}_secret_fake`,
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

async function fixture() {
  await createOrderService(db, stripe).checkout(userId, key, input);
  const [attempt] = await db.select().from(checkoutAttempts);
  if (!attempt) throw new Error('Missing attempt');
  await db
    .update(checkoutAttempts)
    .set({ createdAt: attempt.createdAt })
    .where(eq(checkoutAttempts.id, attempt.id));
  return attempt;
}
function expiry(at: Date, repository = createCheckoutExpiryRepository(db)) {
  return createCheckoutExpiryService(db, stripe, repository, () => at);
}
const deadline = (at: Date) => new Date(at.getTime() + 23 * 3600000);
async function saved(id: string) {
  const [row] = await db.select().from(checkoutAttempts).where(eq(checkoutAttempts.id, id));
  return row!;
}
it('F-06 expires at 23 hours and serializes concurrent workers', async () => {
  const attempt = await fixture();
  await expiry(new Date(deadline(attempt.createdAt).getTime() - 1)).run();
  expect(stripe.cancel).not.toHaveBeenCalled();
  const results = await Promise.all([
    expiry(deadline(attempt.createdAt)).run(),
    expiry(deadline(attempt.createdAt)).run(),
  ]);
  expect(results.reduce((sum, result) => sum + result.completed, 0)).toBe(1);
  expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(
    attempt.paymentIntentId,
    `${attempt.id}:cancel`,
  );
  expect(await saved(attempt.id)).toMatchObject({
    failed: 1,
    paymentVoidedAt: deadline(attempt.createdAt),
  });
  stripe.retrieve.mockClear();
  await expiry(deadline(attempt.createdAt)).run();
  expect(stripe.retrieve).not.toHaveBeenCalled();
});
it('F-06 excludes orders and rechecks after candidate selection', async () => {
  const attempt = await fixture();
  const repository = createCheckoutExpiryRepository(db);
  const candidates = vi
    .fn<typeof repository.candidates>()
    .mockImplementationOnce(async (...args) => {
      const rows = await repository.candidates(...args);
      const intent = intents.get(attempt.paymentIntentId!)!;
      intent.status = 'requires_capture';
      intent.amount_capturable = intent.amount;
      await createOrderService(db, stripe).checkout(userId, key, input);
      return rows;
    })
    .mockImplementation((...args) => repository.candidates(...args));
  stripe.retrieve.mockClear();
  expect(await expiry(deadline(attempt.createdAt), { ...repository, candidates }).run()).toEqual({
    completed: 0,
    failed: 0,
  });
  expect(await db.select().from(orders)).toHaveLength(1);
  stripe.retrieve.mockClear();
  await expiry(deadline(attempt.createdAt)).run();
  expect(stripe.retrieve).not.toHaveBeenCalled();
  expect(stripe.cancel).not.toHaveBeenCalled();
});
it.each([false, true])(
  'F-06 reconciles failed cancellation or lost response (%s)',
  async (lost) => {
    const attempt = await fixture();
    const cancel = stripe.cancel.getMockImplementation()!;
    stripe.cancel.mockImplementationOnce(async (...args) => {
      if (lost) await cancel(...args);
      throw new Error('unavailable');
    });
    expect((await expiry(deadline(attempt.createdAt)).run()).failed).toBe(1);
    expect((await saved(attempt.id)).paymentVoidedAt).toBeNull();
    expect((await expiry(deadline(attempt.createdAt)).run()).completed).toBe(1);
    expect(stripe.cancel).toHaveBeenCalledTimes(lost ? 1 : 2);
    expect(stripe.cancel.mock.calls.every((call) => call[1] === `${attempt.id}:cancel`)).toBe(true);
  },
);
it.each([
  'requires_action',
  'requires_confirmation',
  'requires_capture',
  'requires_payment_method',
  'canceled',
])('F-06 reconciles safe state %s', async (status) => {
  const attempt = await fixture();
  const intent = intents.get(attempt.paymentIntentId!)!;
  intent.status = status;
  intent.amount_capturable = status === 'requires_capture' ? intent.amount : 0;
  expect(await expiry(deadline(attempt.createdAt)).run()).toEqual({ completed: 1, failed: 0 });
  expect(stripe.cancel).toHaveBeenCalledTimes(status === 'canceled' ? 0 : 1);
});
it.each([
  { status: 'succeeded' },
  { status: 'processing' },
  { status: 'unknown' },
  { id: 'pi_other' },
  { amount: 1 },
  { currency: 'usd' },
  { capture_method: 'automatic' },
  { livemode: true },
  { livemode: undefined },
  { amount_capturable: 1 },
  { amount_received: 1 },
])('F-06 reports ambiguous intent %j without cancellation', async (values) => {
  const attempt = await fixture();
  Object.assign(intents.get(attempt.paymentIntentId!)!, values);
  expect(await expiry(deadline(attempt.createdAt)).run()).toEqual({ completed: 0, failed: 1 });
  expect(stripe.cancel).not.toHaveBeenCalled();
  expect((await saved(attempt.id)).failed).toBe(0);
});
it('F-06 preserves missing intent IDs for operations without creating a replacement', async () => {
  const attempt = await fixture();
  await db
    .update(checkoutAttempts)
    .set({ paymentIntentId: null })
    .where(eq(checkoutAttempts.id, attempt.id));
  stripe.create.mockClear();
  stripe.retrieve.mockClear();
  expect((await expiry(deadline(attempt.createdAt)).run()).failed).toBe(1);
  expect(stripe.create).not.toHaveBeenCalled();
  expect(stripe.retrieve).not.toHaveBeenCalled();
});
it('F-06 reconciles a lost database completion after cancel', async () => {
  const attempt = await fixture();
  const repository = createCheckoutExpiryRepository(db);
  const complete = vi
    .fn<typeof repository.complete>()
    .mockRejectedValueOnce(new Error('DB failure'));
  expect(
    (await expiry(deadline(attempt.createdAt), { ...repository, complete }).run()).failed,
  ).toBe(1);
  expect((await expiry(deadline(attempt.createdAt)).run()).completed).toBe(1);
  expect(stripe.cancel).toHaveBeenCalledOnce();
});
it('F-06 scans at most 100 candidates per page and continues after failures', async () => {
  const attempt = await fixture();
  const at = deadline(attempt.createdAt);
  await db.insert(checkoutAttempts).values(
    Array.from({ length: 101 }, () => ({
      userId,
      idempotencyKey: randomUUID(),
      requestHash: 'synthetic',
      quote: attempt.quote,
      createdAt: attempt.createdAt,
    })),
  );
  const repository = createCheckoutExpiryRepository(db);
  expect(await repository.candidates(at)).toHaveLength(100);
  expect(await expiry(at).run()).toEqual({ completed: 1, failed: 101 });
});
it('F-06 validates cancel responses before marking completion', async () => {
  const attempt = await fixture();
  stripe.cancel.mockResolvedValueOnce({
    ...intents.get(attempt.paymentIntentId!)!,
    status: 'canceled',
    amount: 1,
  });
  expect((await expiry(deadline(attempt.createdAt)).run()).failed).toBe(1);
  expect((await saved(attempt.id)).paymentVoidedAt).toBeNull();
});
