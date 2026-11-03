import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { menuResponseSchema } from '@repo/contract';
import { createDb, menuCategories, menuItems, sessions, stores, users } from '@repo/db';
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

async function customer(role: 'customer' | 'store' | 'courier' | 'admin' = 'customer') {
  const id = randomUUID();
  const token = randomUUID();
  await db.insert(users).values({
    id,
    name: '非公開利用者',
    email: `${id}@example.test`,
    phoneNumber: '09012345678',
    role,
    emailVerified: false,
  });
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId: id, token, expiresAt: new Date(Date.now() + 3600000) });
  const signature = createHmac('sha256', config.secret).update(token).digest('base64');
  return { id, cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}` };
}
async function store() {
  const [row] = await db
    .insert(stores)
    .values({ name: 'テスト店舗', address: '店舗住所', latitude: 35, longitude: 139 })
    .returning();
  if (!row) throw new Error('fixture failed');
  return row;
}
async function category(storeId: string, values: Partial<typeof menuCategories.$inferInsert> = {}) {
  const [row] = await db
    .insert(menuCategories)
    .values({ storeId, name: 'カテゴリ', ...values })
    .returning();
  if (!row) throw new Error('fixture failed');
  return row;
}
async function item(
  storeId: string,
  categoryId: string,
  values: Partial<typeof menuItems.$inferInsert> = {},
) {
  const [row] = await db
    .insert(menuItems)
    .values({ storeId, categoryId, name: '商品', price: 500, ...values })
    .returning();
  if (!row) throw new Error('fixture failed');
  return row;
}
function request(storeId: string, cookie?: string, query = '') {
  return app.request(`${config.baseURL}/stores/${storeId}/menu${query}`, {
    headers: cookie ? { cookie } : {},
  });
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

describe('メニュー取得API（実PostgreSQL）', () => {
  it('R-10 カテゴリと商品を順序・UUID順で返し、売り切れ・空カテゴリを含め他店は混入しない', async () => {
    const owner = await customer();
    const target = await store();
    const other = await store();
    const late = await category(target.id, { sortOrder: 10 });
    const second = await category(target.id, {
      id: '00000000-0000-4000-8000-000000000002',
      sortOrder: 1,
    });
    const first = await category(target.id, {
      id: '00000000-0000-4000-8000-000000000001',
      sortOrder: 1,
      description: '説明',
      photoUrl: 'https://example.test/category.jpg',
    });
    const otherCategory = await category(other.id, { sortOrder: 0, name: '他店カテゴリ' });
    await item(other.id, otherCategory.id, { name: '他店商品' });
    const lastItem = await item(target.id, first.id, { sortOrder: 2 });
    const itemB = await item(target.id, first.id, {
      id: '00000000-0000-4000-8000-000000000012',
      sortOrder: 1,
    });
    const itemA = await item(target.id, first.id, {
      id: '00000000-0000-4000-8000-000000000011',
      sortOrder: 1,
      soldout: true,
      price: 1234,
      description: '税込商品',
      photoUrl: 'https://example.test/item.jpg',
    });
    await item(target.id, late.id, { price: 0 });
    const rpc = testClient(app);
    const response = await rpc.stores[':storeId'].menu.$get(
      { param: { storeId: target.id }, query: {} },
      { headers: { cookie: owner.cookie } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body: unknown = await response.json();
    const result = menuResponseSchema.parse(body);
    expect(result.categories.map((row) => row.id)).toEqual([first.id, second.id, late.id]);
    expect(result.categories[0]?.items.map((row) => row.id)).toEqual([
      itemA.id,
      itemB.id,
      lastItem.id,
    ]);
    expect(result.categories[1]?.items).toEqual([]);
    expect(result.categories[0]?.items[0]).toEqual({
      id: itemA.id,
      name: itemA.name,
      description: itemA.description,
      price: 1234,
      photoUrl: itemA.photoUrl,
      soldout: true,
      sortOrder: 1,
    });
    expect(result.categories[0]).toMatchObject({
      description: first.description,
      photoUrl: first.photoUrl,
    });
    expect(result.categories[0]?.items[1]?.photoUrl).toBeNull();
    // parse後の比較だけではschemaに削除された漏洩を見逃すのでraw応答を検査する。
    expect(body).toEqual(result);
    expect(Object.keys(result)).toEqual(['store', 'categories']);
    expect(Object.keys(result.store).sort()).toEqual(
      [
        'id',
        'name',
        'description',
        'address',
        'latitude',
        'longitude',
        'deliveryRadiusMeters',
        'minimumOrderAmount',
        'isAcceptingOrders',
        'photoUrl',
      ].sort(),
    );
    expect(Object.keys(result.categories[0] ?? {}).sort()).toEqual(
      ['id', 'name', 'description', 'photoUrl', 'sortOrder', 'items'].sort(),
    );
    expect(JSON.stringify(body)).not.toContain('storeId');
    expect(JSON.stringify(body)).not.toContain('categoryId');
    expect(JSON.stringify(body)).not.toContain('非公開');
    expect(JSON.stringify(body)).not.toContain('他店');
    expect(JSON.stringify(body)).not.toContain(owner.id);
    expect(geocode).not.toHaveBeenCalled();
    expect(await (await request(target.id, owner.cookie)).json()).toEqual(body);
  });
  it('R-09 空メニューでも成功し、DBで変更した店舗の受付停止状態を返す', async () => {
    const owner = await customer();
    const target = await store();
    expect(await (await request(target.id, owner.cookie)).json()).toEqual({
      store: target,
      categories: [],
    });
    await db.update(stores).set({ isAcceptingOrders: false }).where(eq(stores.id, target.id));
    const stopped = await request(target.id, owner.cookie);
    expect(stopped.status).toBe(200);
    expect(menuResponseSchema.parse(await stopped.json())).toEqual({
      store: { ...target, isAcceptingOrders: false },
      categories: [],
    });
    const section = await category(target.id);
    const product = await item(target.id, section.id);
    await db.update(menuItems).set({ soldout: true }).where(eq(menuItems.id, product.id));
    expect(
      menuResponseSchema.parse(await (await request(target.id, owner.cookie)).json()).categories[0]
        ?.items[0]?.soldout,
    ).toBe(true);
  });
  it('未認証401、停止・他role403で入力検証より先に認可する', async () => {
    const anonymous = await request('invalid');
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('cache-control')).toBe('no-store');
    const disabled = await customer();
    await db.update(users).set({ disabled: true }).where(eq(users.id, disabled.id));
    expect((await request(randomUUID(), disabled.cookie)).status).toBe(403);
    for (const role of ['store', 'courier', 'admin'] as const) {
      const other = await customer(role);
      expect((await request('invalid', other.cookie)).status).toBe(403);
    }
  });
  it('不正ID・未知query・重複queryは400、不存在storeは404を返す', async () => {
    const owner = await customer();
    const target = await store();
    for (const id of ['invalid', '1', '00000000-0000-0000-0000-00000000000g']) {
      expect((await request(id, owner.cookie)).status).toBe(400);
    }
    for (const query of [
      '?extra=1',
      '?extra=1&extra=2',
      '?storeId=' + target.id,
      '?addressId=' + randomUUID(),
      '?soldout=false',
      '?=',
    ]) {
      const response = await request(target.id, owner.cookie, query);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: 'VALIDATION_ERROR',
        message: '入力内容を確認してください',
      });
    }
    const absent = await request(randomUUID(), owner.cookie);
    expect(absent.status).toBe(404);
    expect(absent.headers.get('cache-control')).toBe('no-store');
    expect(await absent.json()).toEqual({ code: 'NOT_FOUND', message: '店舗が見つかりません' });
  });
  it('R-02 DBは別店舗カテゴリ・不存在参照・負額・小数円・負の順序を拒否する', async () => {
    const target = await store();
    const other = await store();
    const section = await category(target.id);
    for (const [storeId, categoryId] of [
      [other.id, section.id],
      [target.id, randomUUID()],
      [randomUUID(), section.id],
    ]) {
      await expect(item(storeId ?? '', categoryId ?? '')).rejects.toMatchObject({
        cause: { code: '23503' },
      });
    }
    await expect(category(randomUUID())).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(item(target.id, section.id, { price: -1 })).rejects.toMatchObject({
      cause: { code: '23514' },
    });
    await expect(item(target.id, section.id, { price: 1.5 })).rejects.toMatchObject({
      cause: { code: '22P02' },
    });
    await expect(item(target.id, section.id, { sortOrder: -1 })).rejects.toMatchObject({
      cause: { code: '23514' },
    });
    await expect(category(target.id, { sortOrder: -1 })).rejects.toMatchObject({
      cause: { code: '23514' },
    });
    await item(target.id, section.id);
    await db.delete(menuCategories).where(eq(menuCategories.id, section.id));
    expect(await db.select().from(menuItems)).toEqual([]);
    await category(target.id);
    await db.delete(stores).where(eq(stores.id, target.id));
    expect(await db.select().from(menuCategories)).toEqual([]);
  });
});
