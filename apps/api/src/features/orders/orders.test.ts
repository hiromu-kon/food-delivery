import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  addresses,
  checkoutAttempts,
  createDb,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  orderSettings,
  sessions,
  stores,
  users,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';
import {
  PaymentError,
  type PaymentIntent,
  type StripeClient,
} from '../../integrations/stripe/client';
import { createOrderService } from './orders.service';
import { createOrderRepository } from './orders.repository';
import type { CheckoutInput } from './orders.schema';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/food_delivery_test')
  throw new Error('Dedicated TEST_DATABASE_URL required');
const db = createDb(url);
const config = {
  baseURL: 'http://api.example.test',
  webURL: 'http://web.example.test',
  secret: 'test-only-secret-not-for-production-use-0123456789',
  secureCookies: false,
};
const auth = createAuthService(db, { send: () => Promise.resolve() }, config);
let intents: Map<string, PaymentIntent>;
let createKeys: Map<string, string>;
const stripe = {
  create: vi.fn<StripeClient['create']>(),
  retrieve: vi.fn<StripeClient['retrieve']>(),
  confirm: vi.fn<StripeClient['confirm']>(),
  cancel: vi.fn<StripeClient['cancel']>(),
};
const app = createApp({ auth, db, config, stripe, getClientIp: () => undefined });
let userId: string;
let cookie: string;
let input: CheckoutInput;
let key: string;
function post(body: unknown = input, idempotencyKey: string = key, session = cookie) {
  return app.request('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: config.webURL,
      cookie: session,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}
async function savedCounts() {
  return {
    orders: (await db.select().from(orders)).length,
    items: (await db.select().from(orderItems)).length,
  };
}
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
  const signature = createHmac('sha256', config.secret).update(token).digest('base64');
  cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
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

describe('F-06 checkout, isolated PostgreSQL and injected Stripe', () => {
  it('R-02 R-05 R-13 authorizes DB totals, creates pending and preserves snapshots', async () => {
    await db.update(orderSettings).set({ deliveryFee: 400 }).where(eq(orderSettings.id, 1));
    const response = await post();
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      order: NonNullable<Awaited<ReturnType<ReturnType<typeof createOrderService>['checkout']>>>;
    };
    expect(body.order).toMatchObject({
      status: 'pending',
      subtotal: 1400,
      deliveryFee: 400,
      total: 1800,
      address: 'Home',
      building: '101',
      deliveryNote: '入口',
    });
    expect(body.order.items[0]).toMatchObject({ name: 'Curry', unitPrice: 700, quantity: 2 });
    expect(stripe.create).toHaveBeenCalledWith(1800, 'pm_fake', expect.stringMatching(/:create$/));
    expect(stripe.confirm).toHaveBeenCalledOnce();
    await db
      .update(menuItems)
      .set({ name: 'New', price: 900 })
      .where(eq(menuItems.id, input.items[0]!.menuItemId));
    await db.update(addresses).set({ address: 'Moved' }).where(eq(addresses.id, input.addressId));
    await db.update(orderSettings).set({ deliveryFee: 900 }).where(eq(orderSettings.id, 1));
    expect((await db.select().from(orderItems))[0]).toMatchObject({
      name: 'Curry',
      unitPrice: 700,
    });
    expect((await db.select().from(orders))[0]).toMatchObject({
      address: 'Home',
      deliveryFee: 400,
      total: 1800,
    });
    const replay = await post();
    expect(replay.status).toBe(201);
    expect(await replay.json()).toMatchObject({ order: { id: body.order.id } });
    expect(stripe.confirm).toHaveBeenCalledOnce();
  });
  it.each([
    { total: 1 },
    { subtotal: 1 },
    { deliveryFee: 0 },
    { items: [{ menuItemId: randomUUID(), quantity: 1, unitPrice: 1 }] },
  ])('R-02 rejects client prices %j', async (patch) => {
    expect((await post({ ...input, ...patch })).status).toBe(400);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it.each([0, -1, 21, 1.5])('R-03 invalid quantity %s', async (quantity) => {
    expect((await post({ ...input, items: [{ ...input.items[0], quantity }] })).status).toBe(400);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it('R-03 rejects empty and duplicate items', async () => {
    expect((await post({ ...input, items: [] })).status).toBe(400);
    expect((await post({ ...input, items: [input.items[0], input.items[0]] })).status).toBe(400);
  });
  it('R-01 checks address ownership and delivery radius', async () => {
    const other = randomUUID();
    await db.insert(users).values({
      id: other,
      name: 'Other',
      email: `${other}@example.test`,
      phoneNumber: '09011111111',
    });
    await db.update(addresses).set({ userId: other }).where(eq(addresses.id, input.addressId));
    expect((await post()).status).toBe(404);
    await db
      .update(addresses)
      .set({ userId, latitude: 36 })
      .where(eq(addresses.id, input.addressId));
    expect((await post()).status).toBe(422);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it('R-09 rejects paused stores', async () => {
    await db.update(stores).set({ isAcceptingOrders: false }).where(eq(stores.id, input.storeId));
    expect((await post()).status).toBe(422);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it('R-10 rejects sold-out and missing items', async () => {
    await db
      .update(menuItems)
      .set({ soldout: true })
      .where(eq(menuItems.id, input.items[0]!.menuItemId));
    expect((await post()).status).toBe(422);
    input.items[0]!.menuItemId = randomUUID();
    expect((await post()).status).toBe(422);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it('R-03 rejects a product belonging to another store', async () => {
    const [other] = await db
      .insert(stores)
      .values({ name: 'Other', address: 'Tokyo', latitude: 35, longitude: 139 })
      .returning();
    input.storeId = other!.id;
    expect((await post()).status).toBe(422);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it('R-04 excludes fee from minimum; boundary is allowed', async () => {
    await db.update(stores).set({ minimumOrderAmount: 1401 }).where(eq(stores.id, input.storeId));
    expect((await post()).status).toBe(422);
    await db.update(stores).set({ minimumOrderAmount: 1400 }).where(eq(stores.id, input.storeId));
    expect((await post()).status).toBe(201);
  });
  it('R-15 validates dropoff location, note, and snapshots fulfillment', async () => {
    expect((await post({ ...input, fulfillment: 'leave_at_door' })).status).toBe(400);
    expect(
      (await post({ ...input, fulfillment: 'leave_at_door', dropoffLocation: 'other' })).status,
    ).toBe(400);
    expect((await post({ ...input, deliveryNote: 'x'.repeat(101) })).status).toBe(400);
    expect(
      (
        await post({
          ...input,
          fulfillment: 'leave_at_door',
          dropoffLocation: 'other',
          deliveryNote: '裏口',
        })
      ).status,
    ).toBe(201);
    expect((await db.select().from(orders))[0]).toMatchObject({
      fulfillment: 'leave_at_door',
      dropoffLocation: 'other',
      deliveryNote: '裏口',
    });
  });
  it('requires verified customer session and idempotency key', async () => {
    expect((await post(input, key, '')).status).toBe(401);
    expect((await post(input, 'bad')).status).toBe(400);
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, userId));
    expect((await post()).status).toBe(403);
    await db.update(users).set({ emailVerified: true, role: 'store' }).where(eq(users.id, userId));
    expect((await post()).status).toBe(403);
    expect(stripe.create).not.toHaveBeenCalled();
  });
  it('R-05 declines and additional authentication never create pending; cancel authorization', async () => {
    stripe.confirm.mockImplementation((id) =>
      Promise.resolve({
        ...intents.get(id)!,
        status: 'requires_action',
      }),
    );
    expect((await post()).status).toBe(402);
    expect(await savedCounts()).toEqual({ orders: 0, items: 0 });
    expect(stripe.cancel).toHaveBeenCalledOnce();
    expect((await post()).status).toBe(402);
    expect(stripe.confirm).toHaveBeenCalledOnce();
  });
  it('R-05 confirm network ambiguity cancels actual authorization', async () => {
    stripe.confirm.mockImplementation((id) => {
      intents.get(id)!.status = 'requires_capture';
      return Promise.reject(new PaymentError('PAYMENT_UNAVAILABLE'));
    });
    expect((await post()).status).toBe(503);
    expect(await savedCounts()).toEqual({ orders: 0, items: 0 });
    expect(stripe.cancel).toHaveBeenCalledOnce();
  });
  it('R-05 DB insert failure rolls back and cancels authorization', async () => {
    const repository = createOrderRepository(db);
    const originalInsert = repository.insert.bind(repository);
    const insert = vi.spyOn(repository, 'insert').mockImplementation(async (...args) => {
      await originalInsert(...args);
      throw new Error('DB insert failure');
    });
    await expect(
      createOrderService(db, stripe, repository).checkout(userId, key, input),
    ).rejects.toThrow('DB insert failure');
    expect(await savedCounts()).toEqual({ orders: 0, items: 0 });
    expect(stripe.cancel).toHaveBeenCalledOnce();
    insert.mockRestore();
  });
  it('R-05 ambiguous successful COMMIT returns stored order without canceling', async () => {
    const repository = createOrderRepository(db);
    const transaction = repository.transaction;
    vi.spyOn(repository, 'transaction').mockImplementationOnce(async (action) => {
      await transaction(action);
      throw new Error('COMMIT response lost');
    });
    const order = await createOrderService(db, stripe, repository).checkout(userId, key, input);
    expect(order.status).toBe('pending');
    expect(await savedCounts()).toEqual({ orders: 1, items: 1 });
    expect(stripe.cancel).not.toHaveBeenCalled();
  });
  it('R-05 DB intent persistence failure never confirms; retry reuses unconfirmed intent', async () => {
    const repository = createOrderRepository(db);
    vi.spyOn(repository, 'setIntent').mockRejectedValueOnce(new Error('DB offline'));
    const service = createOrderService(db, stripe, repository);
    await expect(service.checkout(userId, key, input)).rejects.toThrow('DB offline');
    expect(stripe.confirm).not.toHaveBeenCalled();
    expect(await savedCounts()).toEqual({ orders: 0, items: 0 });
    expect((await service.checkout(userId, key, input)).status).toBe('pending');
    expect(intents.size).toBe(1);
  });
  it('R-05 lost create response is retried idempotently before confirmation', async () => {
    const create = stripe.create.getMockImplementation()!;
    stripe.create.mockImplementationOnce(async (...args) => {
      await create(...args);
      throw new PaymentError('PAYMENT_UNAVAILABLE');
    });
    expect((await post()).status).toBe(503);
    expect(stripe.confirm).not.toHaveBeenCalled();
    expect((await post()).status).toBe(201);
    expect(intents.size).toBe(1);
  });
  it('R-05 does not recreate an unknown intent after Stripe key retention', async () => {
    const service = createOrderService(db, stripe);
    stripe.create.mockRejectedValueOnce(new PaymentError('PAYMENT_UNAVAILABLE'));
    await expect(service.checkout(userId, key, input)).rejects.toMatchObject({
      code: 'PAYMENT_UNAVAILABLE',
    });
    await db.update(checkoutAttempts).set({ createdAt: new Date(Date.now() - 24 * 3600000) });
    await expect(service.checkout(userId, key, input)).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect(stripe.create).toHaveBeenCalledOnce();
    expect(await savedCounts()).toEqual({ orders: 0, items: 0 });
  });
  it('R-05 failed compensation is durable and same-key retry cancels without authorizing again', async () => {
    stripe.confirm.mockRejectedValueOnce(new PaymentError('PAYMENT_FAILED'));
    stripe.cancel.mockRejectedValueOnce(new Error('offline'));
    expect((await post()).status).toBe(503);
    expect((await db.select().from(checkoutAttempts))[0]).toMatchObject({ failed: 1 });
    expect((await post()).status).toBe(402);
    expect(stripe.cancel).toHaveBeenCalledTimes(2);
    expect(stripe.confirm).toHaveBeenCalledOnce();
    expect(await savedCounts()).toEqual({ orders: 0, items: 0 });
  });
  it('R-09 rechecks store acceptance immediately before authorization', async () => {
    const create = stripe.create.getMockImplementation()!;
    stripe.create.mockImplementation(async (...args) => {
      const intent = await create(...args);
      await db.update(stores).set({ isAcceptingOrders: false }).where(eq(stores.id, input.storeId));
      return intent;
    });
    expect((await post()).status).toBe(422);
    expect(stripe.confirm).not.toHaveBeenCalled();
    expect(stripe.cancel).toHaveBeenCalledOnce();
  });
  it('R-05 concurrent retries create one order and one authorization', async () => {
    const responses = await Promise.all([post(), post()]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(await savedCounts()).toEqual({ orders: 1, items: 1 });
    expect(intents.size).toBe(1);
    expect(stripe.confirm).toHaveBeenCalledOnce();
    expect((await post({ ...input, items: [{ ...input.items[0], quantity: 3 }] })).status).toBe(
      409,
    );
  });
});
