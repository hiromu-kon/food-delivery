import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { adminOrderDetailResponseSchema, adminOrderListResponseSchema } from '@repo/contract';
import {
  checkoutAttempts,
  createDb,
  orderAdminEvents,
  orderItems,
  orders,
  sessions,
  stores,
  users,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';
import type { TestRefund, TestRefundClient } from '../../integrations/stripe/test-refunds';
import { createAdminOrderService } from './admin-orders.service';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/food_delivery_test')
  throw new Error('Dedicated TEST_DATABASE_URL required');
const db = createDb(url);
const config = {
  baseURL: 'http://api.example.test',
  webURL: 'http://web.example.test',
  secret: 'fictional-admin-order-test-secret-0123456789',
  secureCookies: false,
};
const auth = createAuthService(db, { send: () => Promise.resolve() }, config);
const refunds = {
  mode: 'test',
  retrievePayment: vi.fn<TestRefundClient['retrievePayment']>(),
  findRefund: vi.fn<TestRefundClient['findRefund']>(),
  refund: vi.fn<TestRefundClient['refund']>(),
} satisfies TestRefundClient;
const service = createAdminOrderService(db, refunds);
let actorId: string;
let id: string;
let storeId: string;
let headers: { authorization: string };
let saved: TestRefund | null;
const app = createApp({
  auth,
  db,
  config,
  testRefunds: refunds,
  getClientIp: () => '203.0.113.19',
});
const request = (path = '', method = 'GET') =>
  app.request(`/admin/orders${path}`, { method, headers });
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
  saved = null;
  await db.execute(sql`truncate users, stores cascade`);
  actorId = randomUUID();
  id = randomUUID();
  storeId = randomUUID();
  await db.insert(users).values({
    id: actorId,
    email: `${actorId}@example.test`,
    name: '架空運営',
    role: 'admin',
    emailVerified: true,
    phoneNumber: '09000000000',
  });
  const token = randomUUID();
  await db.insert(sessions).values({
    id: randomUUID(),
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  headers = {
    authorization: `Bearer ${token}.${createHmac('sha256', config.secret).update(token).digest('base64')}`,
  };
  await db
    .insert(stores)
    .values({ id: storeId, name: '架空店舗', address: '架空住所', latitude: 35, longitude: 139 });
  const quote = {
    storeId,
    address: '架空住所',
    building: '101',
    latitude: 35,
    longitude: 139,
    deliveryNote: '',
    fulfillment: 'hand_delivery' as const,
    dropoffLocation: null,
    subtotal: 1400,
    deliveryFee: 300,
    total: 1700,
    items: [],
  };
  await db
    .insert(checkoutAttempts)
    .values({ id, userId: actorId, idempotencyKey: randomUUID(), requestHash: 'fake', quote });
  await db.insert(orders).values({
    ...quote,
    id,
    userId: actorId,
    paymentIntentId: 'pi_test_f19',
    status: 'preparing',
    courierId: actorId,
    createdAt: new Date('2026-11-15T15:00:00Z'),
  });
  await db.insert(orderItems).values({
    orderId: id,
    menuItemId: randomUUID(),
    name: '架空カレー',
    quantity: 2,
    unitPrice: 700,
  });
  refunds.retrievePayment.mockResolvedValue({
    id: 'pi_test_f19',
    amount: 1700,
    amountReceived: 1700,
    currency: 'jpy',
    status: 'succeeded',
    livemode: false,
  });
  refunds.findRefund.mockImplementation(() => Promise.resolve(saved));
  refunds.refund.mockImplementation((paymentIntentId, amount) => {
    saved = {
      id: 're_test_f19',
      paymentIntentId,
      amount,
      currency: 'jpy',
      status: 'succeeded',
      livemode: false,
    };
    return Promise.resolve(saved);
  });
});
it.each(['preparing', 'ready', 'delivering'] as const)(
  'R-08 %s は配達料を含む全額を一度だけ返金する',
  async (status) => {
    await db.update(orders).set({ status });
    const results = await Promise.all([
      request(`/${id}/cancel`, 'POST'),
      request(`/${id}/cancel`, 'POST'),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const { order } = adminOrderDetailResponseSchema.parse(await results[0].json());
    expect(order).toMatchObject({
      status: 'canceled',
      paymentStatus: 'refunded',
      total: 1700,
      courierId: null,
      cancellationReason: 'admin',
    });
    expect(refunds.refund).toHaveBeenCalledExactlyOnceWith(
      'pi_test_f19',
      1700,
      `admin-refund:${id}`,
    );
    expect(await db.select().from(orderAdminEvents)).toHaveLength(1);
  },
);
it.each(['pending', 'delivered', 'canceled'] as const)('R-08 %s は返金しない', async (status) => {
  await db.update(orders).set({ status });
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(409);
  expect(refunds.refund).not.toHaveBeenCalled();
});
it('R-08 返金の応答喪失後は保存済みの試行を再照合する', async () => {
  const original = refunds.refund.getMockImplementation()!;
  refunds.refund.mockImplementationOnce(async (...args) => {
    await original(...args);
    throw new Error('lost response');
  });
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
  expect((await service.get(actorId, id)).paymentStatus).toBe('reconciling');
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(200);
  expect(refunds.refund).toHaveBeenCalledOnce();
});
it('R-08 保留中の返金を成功扱いせず同じ試行を確認する', async () => {
  saved = {
    id: 're_test_pending',
    paymentIntentId: 'pi_test_f19',
    amount: 1700,
    currency: 'jpy',
    livemode: false,
    status: 'pending',
  };
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
  saved.status = 'succeeded';
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(200);
  expect(refunds.refund).not.toHaveBeenCalled();
});
it('R-08 全額売上・通貨・対象が不一致なら返金を開始しない', async () => {
  for (const patch of [{ amountReceived: 1400 }, { currency: 'usd' }, { id: 'pi_other' }]) {
    refunds.retrievePayment.mockResolvedValueOnce({
      id: 'pi_test_f19',
      amount: 1700,
      amountReceived: 1700,
      currency: 'jpy',
      status: 'succeeded',
      livemode: false,
      ...patch,
    });
    expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
  }
  expect(refunds.refund).not.toHaveBeenCalled();
});
it('R-08 注入なしでは状態変更せず、23時間後は新規返金を送らない', async () => {
  await expect(createAdminOrderService(db).cancel(actorId, id)).rejects.toMatchObject({
    code: 'PAYMENT_UNAVAILABLE',
  });
  expect((await service.get(actorId, id)).status).toBe('preparing');
  await db.update(orders).set({
    status: 'canceled',
    cancellationReason: 'admin',
    refundStartedAt: new Date(Date.now() - 24 * 3600000),
  });
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
  expect(refunds.refund).not.toHaveBeenCalled();
});
it('検索条件・日本時間の日付・秘匿項目・ID検証を確認する', async () => {
  const result = await request(`?status=preparing&storeId=${storeId}&date=2026-11-16`);
  expect(result.status).toBe(200);
  expect(result.headers.get('cache-control')).toBe('no-store');
  const body = adminOrderListResponseSchema.parse(await result.json());
  expect(body.orders).toHaveLength(1);
  expect(body.orders[0]).not.toHaveProperty('paymentIntentId');
  expect(
    adminOrderListResponseSchema.parse(await (await request('?date=2026-11-15')).json()).orders,
  ).toHaveLength(0);
  expect((await request('?date=bad')).status).toBe(400);
  expect((await request('/bad')).status).toBe(400);
  expect((await request(`/${randomUUID()}`)).status).toBe(404);
});
it('R-11 担当解除は状態を維持し、再送では履歴を重複させない', async () => {
  expect((await request(`/${id}/unassign`, 'POST')).status).toBe(200);
  expect((await request(`/${id}/unassign`, 'POST')).status).toBe(200);
  expect(await service.get(actorId, id)).toMatchObject({ status: 'preparing', courierId: null });
  expect(await db.select().from(orderAdminEvents)).toHaveLength(1);
  for (const status of ['delivered', 'canceled'] as const) {
    await db.update(orders).set({ status });
    expect((await request(`/${id}/unassign`, 'POST')).status).toBe(409);
  }
});
it('全エンドポイントは現在の運営権限を確認する', async () => {
  expect((await app.request('/admin/orders')).status).toBe(401);
  for (const patch of [
    { role: 'customer' as const },
    { role: 'admin' as const, disabled: true },
    { disabled: false, emailVerified: false },
  ]) {
    await db.update(users).set(patch).where(eq(users.id, actorId));
    for (const [path, method] of [
      ['', 'GET'],
      [`/${id}`, 'GET'],
      [`/${id}/cancel`, 'POST'],
      [`/${id}/unassign`, 'POST'],
    ])
      expect((await request(path, method)).status).toBe(403);
    await expect(service.get(actorId, id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }
  expect(refunds.refund).not.toHaveBeenCalled();
});
it('R-08 live・不正な決済応答と一部返金を境界で拒否する', async () => {
  refunds.retrievePayment.mockResolvedValueOnce({
    id: 'pi_test_f19',
    amount: 1700,
    amountReceived: 1700,
    currency: 'jpy',
    status: 'succeeded',
    livemode: true,
  });
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
  expect(refunds.refund).not.toHaveBeenCalled();
  refunds.refund.mockResolvedValueOnce({
    id: 're_fake',
    paymentIntentId: 'pi_test_f19',
    amount: 1400,
    currency: 'jpy',
    livemode: false,
    status: 'succeeded',
  });
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
  expect((await service.get(actorId, id)).paymentStatus).toBe('reconciling');
});
it('R-08 返金後のDB失敗でも二重返金せず復旧する', async () => {
  await db.execute(
    sql`create function f19_fail_refund() returns trigger language plpgsql as $$ begin if new.refunded_at is not null then raise exception 'synthetic write failure'; end if; return new; end $$`,
  );
  await db.execute(
    sql`create trigger f19_fail_refund before update on orders for each row execute function f19_fail_refund()`,
  );
  try {
    expect((await request(`/${id}/cancel`, 'POST')).status).toBe(503);
    expect((await service.get(actorId, id)).paymentStatus).toBe('reconciling');
  } finally {
    await db.execute(sql`drop trigger f19_fail_refund on orders`);
    await db.execute(sql`drop function f19_fail_refund()`);
  }
  expect((await request(`/${id}/cancel`, 'POST')).status).toBe(200);
  expect(refunds.refund).toHaveBeenCalledOnce();
});
