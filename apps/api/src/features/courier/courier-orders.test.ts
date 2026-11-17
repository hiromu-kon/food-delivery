import sharp from 'sharp';
import { deliveryPhotos } from '@repo/db';
import { createPostgresDeliveryPhotoStorage } from '../../integrations/delivery-photos/postgres';
import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  customerOrderDetailResponseSchema,
  courierDeliveryHistoryResponseSchema,
  courierOrderListSchema,
  courierOrderResponseSchema,
} from '@repo/contract';
import {
  checkoutAttempts,
  couriers,
  createDb,
  orderItems,
  orderStatusHistory,
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
const photoStorage = createPostgresDeliveryPhotoStorage(db);
const app = createApp({
  auth,
  db,
  config,
  deliveryPhotos: photoStorage,
  getClientIp: () => '203.0.113.63',
});
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
async function order(
  status: typeof orders.$inferSelect.status = 'ready',
  fulfillment: CheckoutQuote['fulfillment'] = 'leave_at_door',
) {
  const id = randomUUID();
  const quote: CheckoutQuote = {
    storeId,
    address: '架空お届け先',
    building: '101',
    latitude: 35.001,
    longitude: 139,
    deliveryNote: '担当者だけのメモ',
    fulfillment,
    dropoffLocation: fulfillment === 'leave_at_door' ? 'front_door' : null,
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
const receive = (actor: typeof a, id: string) => request(actor, `/${id}/receive`, 'POST');
const deliver = (actor: typeof a, id: string) => request(actor, `/${id}/deliver`, 'POST');
async function clean() {
  if (storeId) {
    const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.storeId, storeId));
    for (const row of rows) {
      await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, row.id));
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
    const excludedIds: string[] = [];
    for (const status of ['pending', 'delivering', 'delivered', 'canceled'] as const)
      excludedIds.push(await order(status));
    const response = await request(a, '');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const result = courierOrderListSchema.parse(await response.json());
    expect(result.orders.map((row) => row.id)).toEqual(expect.arrayContaining(ids));
    for (const id of excludedIds) expect(result.orders.map((row) => row.id)).not.toContain(id);
    expect(result.orders.find((row) => row.id === ids[0])?.distanceMeters).toBeCloseTo(111.195, 2);
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
    const loserList = courierOrderListSchema.parse(await (await request(loser, '')).json());
    expect(loserList.orders.map((row) => row.id)).not.toContain(id);
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
    expect(before.order).not.toHaveProperty('customerPhoneNumber');
    expect(before.order.items[0]?.name).toBe('注文時の商品名');
    const first = await accept(a, id);
    expect(first.status).toBe(200);
    const accepted = await first.json();
    expect(accepted).toHaveProperty('order.deliveryNote', '担当者だけのメモ');
    expect(accepted).toHaveProperty('order.customerPhoneNumber', '09000000000');
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

describe('F-15 受け取り・配達完了・履歴（実PostgreSQL、決済なし）', () => {
  it('担当配達員だけが準備完了から配達中へ進め、再送は同じ結果を返す', async () => {
    const id = await order('ready');
    await accept(a, id);
    expect(await (await receive(b, id)).json()).toMatchObject({ code: 'NOT_FOUND' });
    expect(await (await receive(a, id)).json()).toHaveProperty('order.status', 'delivering');
    expect(await (await receive(a, id)).json()).toHaveProperty('order.status', 'delivering');
    const transitions = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, id));
    expect(transitions.filter((entry) => entry.status === 'delivering')).toHaveLength(1);
  });

  it('準備完了以外は受け取れず、担当中以外は配達完了にできない', async () => {
    const preparing = await order('preparing');
    await accept(a, preparing);
    expect((await receive(a, preparing)).status).toBe(409);
    const ready = await order('ready');
    expect((await receive(a, ready)).status).toBe(404);
    await accept(b, ready);
    expect((await deliver(b, ready)).status).toBe(409);
  });

  it('R-15 置き配は写真の送信前に配達完了にできない', async () => {
    const id = await order('ready');
    await accept(a, id);
    await receive(a, id);
    expect(await (await deliver(a, id)).json()).toMatchObject({ code: 'DELIVERY_PHOTO_REQUIRED' });
    expect(await (await request(a, `/${id}`)).json()).toHaveProperty('order.status', 'delivering');
  });

  it('担当配達員だけが配達中から完了に進め、本人の配達履歴だけを新しい順に返す', async () => {
    const first = await order('ready', 'hand_delivery');
    const second = await order('ready', 'hand_delivery');
    await accept(a, first);
    await receive(a, first);
    expect((await deliver(a, first)).status).toBe(200);
    expect((await deliver(a, first)).status).toBe(200);
    const transitions = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, first));
    expect(transitions.filter((entry) => entry.status === 'delivered')).toHaveLength(1);

    await accept(a, second);
    await receive(a, second);
    await deliver(a, second);
    const response = await request(a, '/history');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const result = courierDeliveryHistoryResponseSchema.parse(await response.json());
    const sorted = [...result.deliveries].sort(
      (left, right) =>
        Date.parse(right.deliveredAt) - Date.parse(left.deliveredAt) ||
        right.id.localeCompare(left.id),
    );
    expect(result.deliveries).toEqual(sorted);
    expect(result.deliveries.map((delivery) => delivery.id).sort()).toEqual([first, second].sort());
    expect(result.deliveries[0]).toMatchObject({
      storeName: '架空店舗',
      total: 1000,
    });
    expect(await (await request(b, '/history')).json()).toEqual({ deliveries: [] });
  });
});

async function jpeg() {
  return {
    mimeType: 'image/jpeg',
    base64: (
      await sharp({ create: { width: 16, height: 12, channels: 3, background: '#aa5522' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  };
}
async function upload(actor: typeof a, id: string, body: unknown, target = app) {
  return target.request(`/courier/orders/${id}/photo`, {
    method: 'POST',
    headers: { authorization: actor.authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function customerHeaders(id = customerId) {
  const token = randomUUID();
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId: id, token, expiresAt: new Date(Date.now() + 3600000) });
  return {
    authorization: `Bearer ${token}.${createHmac('sha256', config.secret).update(token).digest('base64')}`,
  };
}
async function assigned() {
  const id = await order();
  await accept(a, id);
  await receive(a, id);
  return id;
}
describe('F-15 置き配写真（実DBストレージ、外部決済なし）', () => {
  it('R-15 写真送信・再送・完了・注文者表示・30日後の非表示と物理削除', async () => {
    const id = await assigned();
    const headers = await customerHeaders();
    expect((await upload(a, id, await jpeg())).status).toBe(200);
    expect((await upload(a, id, await jpeg())).status).toBe(200);
    expect(await (await request(a, `/${id}`)).json()).toHaveProperty(
      'order.hasDeliveryPhoto',
      true,
    );
    const pending = await app.request(`/orders/${id}`, { headers });
    expect(await pending.json()).toHaveProperty('order.deliveryPhotoUrl', null);
    await db
      .update(deliveryPhotos)
      .set({ expiresAt: new Date(Date.now() + 86400000) })
      .where(eq(deliveryPhotos.orderId, id));
    await photoStorage.purge(new Date());
    expect((await deliver(a, id)).status).toBe(200);
    const [saved] = await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id));
    expect(saved!.expiresAt.getTime() - Date.now()).toBeGreaterThan(30 * 86400000 - 5000);
    expect((await deliver(a, id)).status).toBe(200);
    expect(
      (await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id)))[0]!.expiresAt,
    ).toEqual(saved!.expiresAt);
    expect((await upload(a, id, await jpeg())).status).toBe(409);
    const detail = await app.request(`/orders/${id}`, { headers });
    expect(detail.headers.get('cache-control')).toContain('no-store');
    const body = customerOrderDetailResponseSchema.parse(await detail.json());
    expect(body.order.deliveryPhotoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.order).not.toHaveProperty('courierId');
    const other = await customerHeaders(await user('customer'));
    expect((await app.request(`/orders/${id}`, { headers: other })).status).toBe(404);
    expect((await app.request(`/orders/${id}`)).status).toBe(401);
    expect(
      (await app.request(`/orders/${id}`, { headers: { authorization: b.authorization } })).status,
    ).toBe(403);
    const deadline = new Date(Date.now() - 1);
    await db
      .update(deliveryPhotos)
      .set({ expiresAt: deadline })
      .where(eq(deliveryPhotos.orderId, id));
    expect(await (await app.request(`/orders/${id}`, { headers })).json()).toHaveProperty(
      'order.deliveryPhotoUrl',
      null,
    );
    await photoStorage.purge(deadline);
    expect(await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id))).toEqual(
      [],
    );
    await photoStorage.purge(deadline);
  });
  it('R-15 担当外・権限変更・未認証・不正Origin・手渡し・不正状態を拒否する', async () => {
    const id = await assigned();
    const body = await jpeg();
    expect((await upload(b, id, body)).status).toBe(404);
    expect((await upload(a, randomUUID(), body)).status).toBe(404);
    expect(
      (
        await app.request(`/courier/orders/${id}/photo`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request(`/courier/orders/${id}/photo`, {
          method: 'POST',
          headers: {
            cookie: `better-auth.session_token=${encodeURIComponent(a.authorization.slice(7))}`,
            origin: 'http://evil.example.test',
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(403);
    await db.update(users).set({ disabled: true }).where(eq(users.id, a.id));
    expect((await upload(a, id, body)).status).toBe(403);
    await db.update(users).set({ disabled: false }).where(eq(users.id, a.id));
    await db
      .update(orders)
      .set({ fulfillment: 'hand_delivery', dropoffLocation: null })
      .where(eq(orders.id, id));
    expect((await upload(a, id, body)).status).toBe(409);
    expect((await deliver(a, id)).status).toBe(200);
  });
  it('R-15 MIME・サイズ・破損画像・異なる実形式を検証する', async () => {
    const id = await assigned();
    expect((await upload(a, id, { ...(await jpeg()), mimeType: 'image/png' })).status).toBe(400);
    expect((await upload(a, id, { mimeType: 'image/jpeg', base64: 'invalid' })).status).toBe(400);
    expect(
      (
        await upload(a, id, {
          mimeType: 'image/jpeg',
          base64: Buffer.from('not an image').toString('base64'),
        })
      ).status,
    ).toBe(422);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer();
    expect(
      (await upload(a, id, { mimeType: 'image/jpeg', base64: png.toString('base64') })).status,
    ).toBe(422);
    expect(
      (await upload(a, id, { mimeType: 'image/jpeg', base64: 'A'.repeat(2800000) })).status,
    ).toBe(413);
    expect((await deliver(a, id)).status).toBe(409);
  });
  it('R-15 保存未設定と保存失敗は成功にせず、DB書込みもロールバックする', async () => {
    const id = await assigned();
    const disabled = createApp({ auth, db, config, getClientIp: () => undefined });
    expect((await upload(a, id, await jpeg(), disabled)).status).toBe(503);
    expect(
      (
        await disabled.request(`/courier/orders/${id}/deliver`, {
          method: 'POST',
          headers: { authorization: a.authorization },
        })
      ).status,
    ).toBe(503);
    const failing = createApp({
      auth,
      db,
      config,
      getClientIp: () => undefined,
      deliveryPhotos: {
        ...photoStorage,
        async put(tx, photo) {
          await photoStorage.put(tx, photo);
          throw new Error('Injected storage failure');
        },
      },
    });
    expect((await upload(a, id, await jpeg(), failing)).status).toBe(500);
    expect(await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id))).toEqual(
      [],
    );
    expect((await deliver(a, id)).status).toBe(409);
    expect((await upload(a, id, await jpeg())).status).toBe(200);
  });
  it('R-15 前任者と期限切れの写真を完了の根拠にしない', async () => {
    const id = await assigned();
    await upload(a, id, await jpeg());
    await db.update(orders).set({ courierId: b.id }).where(eq(orders.id, id));
    expect((await deliver(b, id)).status).toBe(409);
    await upload(b, id, await jpeg());
    await db
      .update(deliveryPhotos)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(deliveryPhotos.orderId, id));
    expect((await deliver(b, id)).status).toBe(409);
    await photoStorage.purge(new Date());
    expect(await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id))).toEqual(
      [],
    );
  });
  it('R-15 写真送信と完了の競合でも写真がない完了を作らず、履歴を重複させない', async () => {
    const id = await assigned();
    const results = await Promise.all([upload(a, id, await jpeg()), deliver(a, id)]);
    expect(results[0].status).toBe(200);
    expect([200, 409]).toContain(results[1].status);
    expect((await deliver(a, id)).status).toBe(200);
    expect(
      (await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id))).filter(
        (row) => row.status === 'delivered',
      ),
    ).toHaveLength(1);
  });
});

it('R-15 JPEGを再エンコードしてメタデータを取り除く', async () => {
  const id = await assigned();
  const original = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#ffffff' },
  })
    .jpeg()
    .withExif({ IFD0: { ImageDescription: 'private synthetic metadata' } })
    .toBuffer();
  expect((await sharp(original).metadata()).exif).toBeDefined();
  expect(
    (await upload(a, id, { mimeType: 'image/jpeg', base64: original.toString('base64') })).status,
  ).toBe(200);
  const [photo] = await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id));
  expect((await sharp(Buffer.from(photo!.base64, 'base64')).metadata()).exif).toBeUndefined();
});
it('R-15 保存境界が完了途中に失敗すると状態と期限を戻し、手渡しは未設定でも完了する', async () => {
  const id = await assigned();
  await upload(a, id, await jpeg());
  const [before] = await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id));
  const failing = createApp({
    auth,
    db,
    config,
    getClientIp: () => undefined,
    deliveryPhotos: {
      ...photoStorage,
      async complete(tx, orderId, expiresAt) {
        await photoStorage.complete(tx, orderId, expiresAt);
        throw new Error('Injected completion failure');
      },
    },
  });
  expect(
    (
      await failing.request(`/courier/orders/${id}/deliver`, {
        method: 'POST',
        headers: { authorization: a.authorization },
      })
    ).status,
  ).toBe(500);
  expect((await db.select().from(orders).where(eq(orders.id, id)))[0]!.status).toBe('delivering');
  expect(
    (await db.select().from(deliveryPhotos).where(eq(deliveryPhotos.orderId, id)))[0]!.expiresAt,
  ).toEqual(before!.expiresAt);
  const hand = await order('delivering', 'hand_delivery');
  await db.update(orders).set({ courierId: b.id }).where(eq(orders.id, hand));
  const disabled = createApp({ auth, db, config, getClientIp: () => undefined });
  expect(
    (
      await disabled.request(`/courier/orders/${hand}/deliver`, {
        method: 'POST',
        headers: { authorization: b.authorization },
      })
    ).status,
  ).toBe(200);
});
