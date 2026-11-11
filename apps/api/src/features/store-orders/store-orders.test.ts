import { createHmac, randomUUID } from 'node:crypto';
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
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PaymentIntent, type StripeClient } from '../../integrations/stripe/client';
import { createOrderService } from '../orders/orders.service';
import { createStoreOrderService } from './store-orders.service';
import { createStoreOrderRepository } from './store-orders.repository';
import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';
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

describe('F-10 store orders with injected Stripe', () => {
  it('R-05 capture once under concurrent acceptance and ready only from preparing', async () => {
    const { order, staffId, service } = await storeFixture();
    await expect(service.action(staffId, input.storeId, order.id, 'ready')).rejects.toMatchObject({
      code: 'ORDER_INVALID_TRANSITION',
    });
    await Promise.all([
      service.action(staffId, input.storeId, order.id, 'accept'),
      service.action(staffId, input.storeId, order.id, 'accept'),
    ]);
    expect(stripe.capture).toHaveBeenCalledOnce();
    expect((await service.get(staffId, input.storeId, order.id)).status).toBe('preparing');
    await expect(service.action(staffId, input.storeId, order.id, 'reject')).rejects.toMatchObject({
      code: 'ORDER_INVALID_TRANSITION',
    });
    expect((await service.action(staffId, input.storeId, order.id, 'ready')).status).toBe('ready');
    await expect(service.action(staffId, input.storeId, order.id, 'ready')).rejects.toMatchObject({
      code: 'ORDER_INVALID_TRANSITION',
    });
  });
  it('R-06 refuses acceptance at the exact deadline without capture', async () => {
    const { order, staffId } = await storeFixture();
    const service = createStoreOrderService(
      db,
      stripe,
      undefined,
      () => new Date(order.createdAt.getTime() + 600000),
    );
    await expect(service.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
      code: 'ORDER_INVALID_TRANSITION',
    });
    expect(stripe.capture).not.toHaveBeenCalled();
  });
  it('R-05 failed capture remains pending and prevents customer cancellation or rejection until reconciled', async () => {
    const { order, staffId, service } = await storeFixture();
    stripe.capture.mockRejectedValueOnce(new Error('network'));
    await expect(service.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect(await service.get(staffId, input.storeId, order.id)).toMatchObject({
      status: 'pending',
      paymentReconciling: true,
    });
    await expect(createOrderService(db, stripe).cancel(userId, order.id)).rejects.toMatchObject({
      code: 'ORDER_NOT_CANCELABLE',
    });
    await expect(service.action(staffId, input.storeId, order.id, 'reject')).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect((await service.action(staffId, input.storeId, order.id, 'accept')).status).toBe(
      'preparing',
    );
  });
  it('R-05 reconciles a lost capture response durably without a second capture even after deadline', async () => {
    const { order, staffId, service } = await storeFixture();
    const capture = stripe.capture.getMockImplementation()!;
    stripe.capture.mockImplementationOnce(async (id, captureKey) => {
      await capture(id, captureKey);
      throw new Error('lost response');
    });
    await expect(service.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    const restarted = createStoreOrderService(
      db,
      stripe,
      undefined,
      () => new Date(Date.now() + 86400000),
    );
    expect((await restarted.action(staffId, input.storeId, order.id, 'accept')).status).toBe(
      'preparing',
    );
    expect(stripe.capture).toHaveBeenCalledOnce();
  });
  it('R-05 rejection reserves cancellation and retries a lost void response', async () => {
    const { order, staffId, service } = await storeFixture();
    const cancel = stripe.cancel.getMockImplementation()!;
    stripe.cancel.mockImplementationOnce(async (id, cancelKey) => {
      await cancel(id, cancelKey);
      throw new Error('lost');
    });
    await expect(service.action(staffId, input.storeId, order.id, 'reject')).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    await expect(service.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
      code: 'ORDER_INVALID_TRANSITION',
    });
    expect((await service.action(staffId, input.storeId, order.id, 'reject')).status).toBe(
      'canceled',
    );
    expect(stripe.cancel).toHaveBeenCalledOnce();
  });
  it('R-05 cancellation and accept/reject races serialize on the order row', async () => {
    const { order, staffId, service } = await storeFixture();
    const results = await Promise.allSettled([
      createOrderService(db, stripe).cancel(userId, order.id),
      service.action(staffId, input.storeId, order.id, 'accept'),
      service.action(staffId, input.storeId, order.id, 'reject'),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(stripe.capture.mock.calls.length + stripe.cancel.mock.calls.length).toBe(1);
  });
  it('ownership and current membership are required for every read and mutation; private payment fields are excluded', async () => {
    const { order, staffId, service } = await storeFixture();
    expect(await service.list(userId, input.storeId)).toEqual([]);
    await expect(service.get(userId, input.storeId, order.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await service.get(staffId, input.storeId, order.id)).not.toHaveProperty(
      'paymentIntentId',
    );
    await db.delete(storeStaffMemberships).where(eq(storeStaffMemberships.userId, staffId));
    for (const action of ['accept', 'reject', 'ready'] as const)
      await expect(service.action(staffId, input.storeId, order.id, action)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    expect(stripe.capture).not.toHaveBeenCalled();
  });
});

it('R-05 captured payment survives a DB write failure and reconciles without capturing again', async () => {
  const { order, staffId } = await storeFixture();
  const repository = createStoreOrderRepository(db);
  const update: typeof repository.update = (...args) => repository.update(...args);
  const fault = {
    ...repository,
    update: vi.fn<typeof update>().mockImplementation(async (tx, id, values) => {
      if (values.status === 'preparing') throw new Error('DB failure');
      await update(tx, id, values);
    }),
  };
  await expect(
    createStoreOrderService(db, stripe, fault).action(staffId, input.storeId, order.id, 'accept'),
  ).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_REQUIRED' });
  expect(
    (await createStoreOrderService(db, stripe).action(staffId, input.storeId, order.id, 'accept'))
      .status,
  ).toBe('preparing');
  expect(stripe.capture).toHaveBeenCalledOnce();
});
it('R-05 refuses inconsistent intents and never repeats a capture after key retention', async () => {
  const { order, staffId, service } = await storeFixture();
  const intent = intents.get(order.paymentIntentId)!;
  intent.currency = 'usd';
  await expect(service.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
    code: 'PAYMENT_RECONCILIATION_REQUIRED',
  });
  intent.currency = 'jpy';
  const expired = createStoreOrderService(
    db,
    stripe,
    undefined,
    () => new Date(Date.now() + 86400000),
  );
  await expect(expired.action(staffId, input.storeId, order.id, 'accept')).rejects.toMatchObject({
    code: 'PAYMENT_RECONCILIATION_REQUIRED',
  });
  expect(stripe.capture).not.toHaveBeenCalled();
  expect((await db.select().from(orders).where(eq(orders.id, order.id)))[0]?.status).toBe(
    'pending',
  );
});
it('store routes require authenticated staff, validate IDs and return scoped contracts', async () => {
  const { order, staffId } = await storeFixture();
  const config = {
    baseURL: 'http://api.example.test',
    webURL: 'http://web.example.test',
    secret: 'test-only-secret-not-for-production-use-0123456789',
    secureCookies: false,
  };
  const auth = createAuthService(db, { send: () => Promise.resolve() }, config);
  const app = createApp({ auth, db, config, stripe, getClientIp: () => undefined });
  const token = randomUUID();
  await db.insert(sessions).values({
    id: randomUUID(),
    userId: staffId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  const signed = `${token}.${createHmac('sha256', config.secret).update(token).digest('base64')}`;
  const headers = { authorization: `Bearer ${signed}` };
  expect((await app.request('/store/orders')).status).toBe(401);
  expect((await app.request('/store/orders/invalid', { headers })).status).toBe(400);
  const list = await app.request('/store/orders', { headers });
  expect(list.status).toBe(200);
  expect(list.headers.get('cache-control')).toBe('no-store');
  expect(await list.json()).toMatchObject({ orders: [{ id: order.id, status: 'pending' }] });
  expect((await app.request(`/store/orders/${randomUUID()}`, { headers })).status).toBe(404);
  expect(
    (await app.request(`/store/orders/${order.id}/accept`, { method: 'POST', headers })).status,
  ).toBe(200);
  expect(
    (await app.request(`/store/orders/${order.id}/ready`, { method: 'POST', headers })).status,
  ).toBe(200);
});
