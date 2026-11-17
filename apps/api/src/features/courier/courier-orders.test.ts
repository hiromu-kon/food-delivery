import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { courierOrderListSchema, courierOrderResponseSchema } from '@repo/contract';
import {
  checkoutAttempts,
  couriers,
  createDb,
  orderItems,
  orders,
  sessions,
  stores,
  users,
  type CheckoutQuote,
} from '@repo/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';

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
const auth = createAuthService(db, { send: async () => {} }, config);
const app = createApp({ auth, db, config, getClientIp: () => '203.0.113.63' });
const userIds: string[] = [];
let storeId: string;
let customerId: string;
let a: Awaited<ReturnType<typeof courier>>;
let b: Awaited<ReturnType<typeof courier>>;
async function user(role: 'courier' | 'customer' = 'courier') {
  const id = randomUUID();
  userIds.push(id);
  await db.insert(users).values({
    id,
    role,
    name: '架空利用者',
    email: `${id}@example.test`,
    phoneNumber: '09000000000',
    emailVerified: true,
  });
  return id;
}
async function courier() {
  const id = await user();
  await db.insert(couriers).values({ userId: id, isAvailable: true });
  const token = randomUUID();
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId: id, token, expiresAt: new Date(Date.now() + 3600000) });
  return {
    id,
    authorization: `Bearer ${token}.${createHmac('sha256', config.secret).update(token).digest('base64')}`,
  };
}
async function order(status: typeof orders.$inferSelect.status = 'ready') {
  const id = randomUUID();
  const quote: CheckoutQuote = {
    storeId,
    address: '架空お届け先',
    building: '101',
    latitude: 35.001,
    longitude: 139,
    deliveryNote: '担当者だけのメモ',
    fulfillment: 'leave_at_door',
    dropoffLocation: 'front_door',
    subtotal: 700,
    deliveryFee: 300,
    total: 1000,
    items: [{ menuItemId: randomUUID(), name: '注文時の商品名', unitPrice: 700, quantity: 1 }],
  };
  await db.insert(checkoutAttempts).values({
    id,
    userId: customerId,
    idempotencyKey: randomUUID(),
    requestHash: 'synthetic',
    quote,
  });
  const { items, ...snapshot } = quote;
  await db
    .insert(orders)
    .values({ ...snapshot, id, userId: customerId, status, paymentIntentId: `pi_fake_${id}` });
  await db.insert(orderItems).values(items.map((item) => ({ ...item, orderId: id })));
  return id;
}
const request = (actor: typeof a, path: string, method = 'GET') =>
  app.request(`/courier/orders${path}`, {
    method,
    headers: { authorization: actor.authorization },
  });
const accept = (actor: typeof a, id: string) => request(actor, `/${id}/accept`, 'POST');
async function clean() {
  if (storeId) {
    const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.storeId, storeId));
    for (const row of rows) {
      await db.delete(orderItems).where(eq(orderItems.orderId, row.id));
      await db.delete(orders).where(eq(orders.id, row.id));
      await db.delete(checkoutAttempts).where(eq(checkoutAttempts.id, row.id));
    }
    await db.delete(stores).where(eq(stores.id, storeId));
  }
  for (const id of userIds.splice(0)) await db.delete(users).where(eq(users.id, id));
}
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
});
beforeEach(async () => {
  await clean();
  customerId = await user('customer');
  a = await courier();
  b = await courier();
  const [store] = await db
    .insert(stores)
    .values({ name: '架空店舗', address: '架空店舗住所', latitude: 35, longitude: 139 })
    .returning();
  storeId = store!.id;
});
afterAll(async () => {
  await clean();
  await db.$client.end();
});

describe('F-14 配達受注（実PostgreSQL、決済なし）', () => {
  it('R-11 調理中・準備完了の未担当注文だけを一覧に返し、距離を計算する', async () => {
    const ids = [await order('preparing'), await order('ready')];
    for (const status of ['pending', 'delivering', 'delivered', 'canceled'] as const)
      await order(status);
    const response = await request(a, '');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const result = courierOrderListSchema.parse(await response.json());
    expect(result.orders.map((row) => row.id)).toEqual(ids);
    expect(result.orders[0]?.distanceMeters).toBeCloseTo(111.195, 2);
    expect(JSON.stringify(result)).not.toContain('担当者だけのメモ');
    expect(JSON.stringify(result)).not.toContain('架空お届け先');
    await db.update(couriers).set({ isAvailable: false }).where(eq(couriers.userId, a.id));
    expect(await (await request(a, '')).json()).toEqual({ orders: [] });
  });
  it('R-11 同じ注文を同時に受けると先着1名だけが担当になる', async () => {
    const id = await order();
    const responses = await Promise.all([accept(a, id), accept(b, id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const [stored] = await db.select().from(orders).where(eq(orders.id, id));
    expect([a.id, b.id]).toContain(stored?.courierId);
    expect(stored?.status).toBe('ready');
    const loser = stored?.courierId === a.id ? b : a;
    expect((await request(loser, `/${id}`)).status).toBe(404);
    expect(await (await request(loser, '')).json()).toEqual({ orders: [] });
  });
  it('R-11 同じ配達員が別注文を同時に受けても1件だけになる', async () => {
    const responses = await Promise.all([
      accept(a, await order()),
      accept(a, await order('preparing')),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const failed = responses.find((r) => r.status === 409)!;
    expect(await failed.json()).toMatchObject({ code: 'COURIER_BUSY' });
    expect(await (await request(a, '/current')).json()).toHaveProperty(
      'order.isAssignedToMe',
      true,
    );
  });
  it('R-11/R-15 再送は同じ担当結果を返し、配達メモは担当者にだけ返す', async () => {
    const id = await order('preparing');
    const before = courierOrderResponseSchema.parse(await (await request(a, `/${id}`)).json());
    expect(before.order).not.toHaveProperty('deliveryNote');
    expect(before.order.items[0]?.name).toBe('注文時の商品名');
    const first = await accept(a, id);
    expect(first.status).toBe(200);
    expect(await first.json()).toHaveProperty('order.deliveryNote', '担当者だけのメモ');
    await db.update(couriers).set({ isAvailable: false }).where(eq(couriers.userId, a.id));
    expect((await accept(a, id)).status).toBe(200);
    expect(await (await request(a, '/current')).json()).toHaveProperty('order.id', id);
    expect((await accept(a, await order())).status).toBe(409);
    await db.update(orders).set({ status: 'delivered' }).where(eq(orders.id, id));
    await db.update(couriers).set({ isAvailable: true }).where(eq(couriers.userId, a.id));
    expect((await accept(a, await order())).status).toBe(200);
  });
  it('R-11 休止中・担当済み・配達待ち以外・存在しない注文を拒否する', async () => {
    const id = await order();
    await db.update(couriers).set({ isAvailable: false }).where(eq(couriers.userId, a.id));
    expect(await (await accept(a, id)).json()).toMatchObject({ code: 'COURIER_UNAVAILABLE' });
    await accept(b, id);
    expect(await (await accept(a, id)).json()).toMatchObject({ code: 'ORDER_ALREADY_ASSIGNED' });
    for (const status of ['pending', 'delivering', 'delivered', 'canceled'] as const)
      expect((await accept(a, await order(status))).status).toBe(409);
    expect((await accept(a, randomUUID())).status).toBe(404);
    expect((await accept(a, 'invalid')).status).toBe(400);
  });
  it.each(['disabled', 'role', 'registration', 'email'] as const)(
    'R-14 現在の権限変更 %s を一覧・詳細・担当中・受注のすべてで拒否する',
    async (change) => {
      const id = await order();
      if (change === 'registration') await db.delete(couriers).where(eq(couriers.userId, a.id));
      else
        await db
          .update(users)
          .set(
            change === 'disabled'
              ? { disabled: true }
              : change === 'role'
                ? { role: 'customer' }
                : { emailVerified: false },
          )
          .where(eq(users.id, a.id));
      for (const path of ['', '/current', `/${id}`])
        expect((await request(a, path)).status).toBe(403);
      expect((await accept(a, id)).status).toBe(403);
      expect((await db.select().from(orders).where(eq(orders.id, id)))[0]?.courierId).toBeNull();
    },
  );
  it('認証・CookieのOrigin検証を取得と受注にも適用する', async () => {
    const id = await order();
    expect((await app.request('/courier/orders')).status).toBe(401);
    expect((await app.request(`/courier/orders/${id}/accept`, { method: 'POST' })).status).toBe(
      401,
    );
    const signed = a.authorization.slice('Bearer '.length);
    const cookie = `better-auth.session_token=${encodeURIComponent(signed)}`;
    expect(
      (
        await app.request(`/courier/orders/${id}/accept`, {
          method: 'POST',
          headers: { cookie, origin: 'http://evil.example.test' },
        })
      ).status,
    ).toBe(403);
  });
});
