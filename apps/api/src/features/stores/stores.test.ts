import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { storeSearchResponseSchema } from '@repo/contract';
import { addresses, createDb, sessions, stores, users } from '@repo/db';
import { distanceMeters } from '@repo/domain';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/food_delivery_test')
  throw new Error('TEST_DATABASE_URL で専用 food_delivery_test データベースを指定してください');
const db = createDb(databaseUrl);
const config = {
  baseURL: 'http://api.example.test',
  webURL: 'http://web.example.test',
  secret: 'test-only-secret-not-for-production-use-0123456789',
  secureCookies: false,
};
const auth = createAuthService(db, { send: () => Promise.resolve() }, config);
const geocode = vi.fn();
const app = createApp({ auth, db, config, getClientIp: () => undefined, geocoder: { geocode } });
const center = { latitude: 35, longitude: 139 };

async function seedCustomer(role: 'customer' | 'store' | 'courier' | 'admin' = 'customer') {
  const id = randomUUID();
  const token = randomUUID();
  await db.insert(users).values({
    id,
    name: '店舗検索テスト',
    email: `${id}@example.test`,
    phoneNumber: '09012345678',
    role,
    emailVerified: false,
  });
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId: id, token, expiresAt: new Date(Date.now() + 3600000) });
  const signature = createHmac('sha256', config.secret).update(token).digest('base64');
  const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  const [address] = await db
    .insert(addresses)
    .values({
      userId: id,
      address: '非公開のお届け先',
      building: '非公開の建物',
      deliveryNote: '非公開のメモ',
      ...center,
    })
    .returning();
  if (!address) throw new Error('fixture failed');
  return { id, cookie, addressId: address.id };
}
async function seedStore(values: Partial<typeof stores.$inferInsert> = {}) {
  const [store] = await db
    .insert(stores)
    .values({ name: 'テスト専用店舗', address: 'テスト専用店舗住所', ...center, ...values })
    .returning();
  if (!store) throw new Error('fixture failed');
  return store;
}
function request(query: string, cookie?: string) {
  return app.request(`${config.baseURL}/stores${query}`, { headers: cookie ? { cookie } : {} });
}
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
});
beforeEach(async () => {
  await db.execute(
    sql`truncate stores, sessions, accounts, verifications, rate_limits, users cascade`,
  );
  geocode.mockClear();
});
afterAll(async () => {
  await db.$client.end();
});

describe('店舗検索 API（実PostgreSQL）', () => {
  it('R-01 R-09 本人住所から店舗ごとの圏内だけを距離・ID順で返し、停止店舗も注文不可として残す', async () => {
    const owner = await seedCustomer();
    const sameB = await seedStore({
      id: '00000000-0000-4000-8000-000000000002',
      description: '紹介',
      photoUrl: 'https://example.test/photo.jpg',
      minimumOrderAmount: 1000,
    });
    const sameA = await seedStore({
      id: '00000000-0000-4000-8000-000000000001',
      isAcceptingOrders: false,
    });
    const edgePoint = { latitude: 35.01, longitude: 139 };
    const edgeDistance = distanceMeters(center, edgePoint);
    const edge = await seedStore({ ...edgePoint, deliveryRadiusMeters: edgeDistance });
    await seedStore({ ...edgePoint, deliveryRadiusMeters: edgeDistance - 0.000001 });
    const far = await seedStore({ latitude: 35.1, deliveryRadiusMeters: 20000 });
    await seedStore({ latitude: 35.1 });
    const rpc = testClient(app);
    const response = await rpc.stores.$get(
      { query: { addressId: owner.addressId } },
      { headers: { cookie: owner.cookie } },
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const parsed = storeSearchResponseSchema.parse(body);
    expect(parsed.stores.map((store) => store.id)).toEqual([sameA.id, sameB.id, edge.id, far.id]);
    expect(parsed.stores).toEqual([
      { ...sameA, distanceMeters: 0, canOrder: false },
      { ...sameB, distanceMeters: 0, canOrder: true },
      { ...edge, distanceMeters: edgeDistance, canOrder: true },
      { ...far, distanceMeters: distanceMeters(center, far), canOrder: true },
    ]);
    expect(JSON.stringify(body)).not.toContain('非公開');
    expect(JSON.stringify(body)).not.toContain(owner.id);
    expect(JSON.stringify(body)).not.toContain(owner.addressId);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(geocode).not.toHaveBeenCalled();
    await db.update(stores).set({ isAcceptingOrders: false }).where(eq(stores.id, sameB.id));
    const changed = storeSearchResponseSchema.parse(
      await (await request(`?addressId=${owner.addressId}`, owner.cookie)).json(),
    );
    expect(changed.stores.find((store) => store.id === sameB.id)).toMatchObject({
      isAcceptingOrders: false,
      canOrder: false,
    });
  });
  it('R-01 他人のお届け先と不存在は同じ404を返す', async () => {
    const owner = await seedCustomer();
    const other = await seedCustomer();
    const bodies: unknown[] = [];
    for (const id of [other.addressId, randomUUID()]) {
      const response = await request(`?addressId=${id}`, owner.cookie);
      expect(response.status).toBe(404);
      bodies.push(await response.json());
    }
    expect(bodies).toEqual([
      { code: 'NOT_FOUND', message: 'お届け先が見つかりません' },
      { code: 'NOT_FOUND', message: 'お届け先が見つかりません' },
    ]);
  });
  it('R-01 本人住所を使い分け、圏内なし・店舗なしは空配列になる', async () => {
    const owner = await seedCustomer();
    expect(await (await request(`?addressId=${owner.addressId}`, owner.cookie)).json()).toEqual({
      stores: [],
    });
    await seedStore();
    const [distant] = await db
      .insert(addresses)
      .values({ userId: owner.id, address: '別のお届け先', latitude: 34, longitude: 135 })
      .returning();
    expect(await (await request(`?addressId=${distant?.id}`, owner.cookie)).json()).toEqual({
      stores: [],
    });
  });
  it('認証なし・停止アカウント・注文者以外を拒否する', async () => {
    expect((await request(`?addressId=${randomUUID()}`)).status).toBe(401);
    const disabled = await seedCustomer();
    await db.update(users).set({ disabled: true }).where(eq(users.id, disabled.id));
    expect((await request(`?addressId=${disabled.addressId}`, disabled.cookie)).status).toBe(403);
    for (const role of ['store', 'courier', 'admin'] as const) {
      const user = await seedCustomer(role);
      expect((await request(`?addressId=${user.addressId}`, user.cookie)).status).toBe(403);
    }
  });
  it('R-01 不正ID・欠落・未知キー・クライアント座標や所有者を拒否する', async () => {
    const owner = await seedCustomer();
    for (const query of [
      '',
      '?addressId=',
      '?addressId=invalid',
      `?addressId=${owner.addressId}&latitude=35&longitude=139`,
      `?addressId=${owner.addressId}&userId=${owner.id}`,
      `?addressId=${owner.addressId}&extra=1`,
      `?addressId=${owner.addressId}&addressId=${randomUUID()}`,
    ]) {
      const response = await request(query, owner.cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: 'VALIDATION_ERROR',
        message: '入力内容を確認してください',
      });
    }
  });
  it('N04 最大100店舗を欠落なく返す', async () => {
    const owner = await seedCustomer();
    await db.insert(stores).values(
      Array.from({ length: 100 }, (_, i) => ({
        name: `テスト店舗${i}`,
        address: 'テスト住所',
        ...center,
      })),
    );
    const response = await request(`?addressId=${owner.addressId}`, owner.cookie);
    expect(response.status).toBe(200);
    expect(storeSearchResponseSchema.parse(await response.json()).stores).toHaveLength(100);
    expect(geocode).not.toHaveBeenCalled();
  });
});
