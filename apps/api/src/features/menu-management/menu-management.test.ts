import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { managedMenuSchema, menuResponseSchema } from '@repo/contract';
import {
  checkoutAttempts,
  orderItems,
  orders,
  menuItems,
  createDb,
  sessions,
  storeStaffMemberships,
  stores,
  users,
} from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';
import { createMenuManagementService } from './menu-management.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/food_delivery_test')
  throw new Error('TEST_DATABASE_URL は専用 food_delivery_test データベースを指定してください');
const db = createDb(databaseUrl);
const config = {
  baseURL: 'http://api.example.test',
  webURL: 'http://web.example.test',
  secret: 'test-only-secret-not-for-production-use-0123456789',
  secureCookies: false,
};
const auth = createAuthService(db, { send: () => Promise.resolve() }, config);
const app = createApp({ auth, db, config, getClientIp: () => undefined });
const client = testClient(app);
const userIds: string[] = [];
const storeIds: string[] = [];

async function store() {
  const id = randomUUID();
  storeIds.push(id);
  const [row] = await db
    .insert(stores)
    .values({
      id,
      name: '架空受付テスト店舗',
      address: '架空住所',
      latitude: 35,
      longitude: 139,
    })
    .returning();
  if (!row) throw new Error('fixture failed');
  return row;
}
async function account(
  storeId?: string,
  role: 'store' | 'customer' | 'courier' | 'admin' = 'store',
) {
  const id = randomUUID();
  userIds.push(id);
  const token = randomUUID();
  await db.insert(users).values({
    id,
    name: '架空受付テスト利用者',
    email: `${id}@example.test`,
    phoneNumber: '09000000000',
    role,
    emailVerified: true,
  });
  if (storeId) await db.insert(storeStaffMemberships).values({ userId: id, storeId });
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId: id, token, expiresAt: new Date(Date.now() + 3600000) });
  const signed = `${token}.${createHmac('sha256', config.secret).update(token).digest('base64')}`;
  return { id, token: signed, cookie: `better-auth.session_token=${encodeURIComponent(signed)}` };
}
function request(
  cookie: string | undefined,
  path = '',
  method = 'GET',
  body?: unknown,
  origin: string | undefined = config.webURL,
) {
  return app.request(`/store/menu${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function fixture() {
  const target = await store();
  const staff = await account(target.id);
  const service = createMenuManagementService(db);
  const { category } = await service.createCategory(staff.id, target.id, {
    name: '主菜',
    description: '',
    photoUrl: null,
    sortOrder: 0,
  });
  const { item } = await service.createItem(staff.id, target.id, {
    name: '料理',
    description: '',
    photoUrl: null,
    sortOrder: 0,
    price: 500,
    soldout: false,
    categoryId: category.id,
  });
  return { target, staff, category, item, service };
}
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
});
afterEach(async () => {
  // 自分で作った UUID のみ削除し、所属・セッション・住所は FK cascade で回収する。
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  if (storeIds.length) await db.delete(stores).where(inArray(stores.id, storeIds));
  userIds.length = 0;
  storeIds.length = 0;
});
afterAll(async () => {
  await db.$client.end();
});

describe('メニュー管理 API（実 PostgreSQL）', () => {
  it('カテゴリ・商品の CRUD、移動、並び順、公開contractとRPC', async () => {
    const { target, staff, category, item } = await fixture();
    const created = await client.store.menu.categories.$post(
      { json: { name: '副菜', sortOrder: 1 } },
      { headers: { authorization: `Bearer ${staff.token}` } },
    );
    expect(created.status).toBe(201);
    const second = await created.json();
    if (!('category' in second)) throw new Error('category missing');
    const updated = await request(staff.cookie, `/categories/${category.id}`, 'PATCH', {
      name: '新主菜',
      description: '説明',
      photoUrl: 'https://web.example.test/menu-images/example.jpg',
      sortOrder: 2,
    });
    expect(updated.status).toBe(200);
    const product = await client.store.menu.items.$post(
      { json: { name: '追加', categoryId: category.id, price: 0 } },
      { headers: { authorization: `Bearer ${staff.token}` } },
    );
    expect(product.status).toBe(201);
    expect(
      (
        await request(staff.cookie, `/items/${item.id}`, 'PATCH', {
          categoryId: second.category.id,
          price: 700,
          name: '変更',
          sortOrder: 3,
        })
      ).status,
    ).toBe(200);
    const read = await client.store.menu.$get({}, { headers: { cookie: staff.cookie } });
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('no-store');
    const menu = managedMenuSchema.parse(await read.json());
    expect(menu.categories.map((c) => c.id)).toEqual([second.category.id, category.id]);
    expect(menu.categories[0]?.items[0]).toMatchObject({
      id: item.id,
      price: 700,
      categoryId: second.category.id,
    });
    expect((await request(staff.cookie, `/categories/${category.id}`)).status).toBe(200);
    expect((await request(staff.cookie, `/items/${item.id}`)).status).toBe(200);
    const partial = await request(staff.cookie, `/items/${item.id}`, 'PATCH', {
      description: '更新',
    });
    expect(await partial.json()).toMatchObject({
      item: {
        name: '変更',
        price: 700,
        categoryId: second.category.id,
        sortOrder: 3,
        soldout: false,
        description: '更新',
      },
    });
    expect(
      (await request(staff.cookie, `/categories/${category.id}`, 'PATCH', { photoUrl: null }))
        .status,
    ).toBe(200);
    const customer = await account(undefined, 'customer');
    const publicResponse = await client.stores[':storeId'].menu.$get(
      { param: { storeId: target.id }, query: {} },
      { headers: { cookie: customer.cookie } },
    );
    const publicMenu = menuResponseSchema.parse(await publicResponse.json());
    expect(publicMenu.categories[0]?.items[0]).not.toHaveProperty('categoryId');
    expect((await request(staff.cookie, `/items/${item.id}`, 'DELETE')).status).toBe(204);
    expect((await request(staff.cookie, `/items/${item.id}`, 'GET')).status).toBe(404);
    expect((await request(staff.cookie, `/categories/${category.id}`, 'DELETE')).status).toBe(204);
    expect(await db.select().from(menuItems).where(eq(menuItems.categoryId, category.id))).toEqual(
      [],
    );
  });
  it('R-10 売り切れは冪等に設定し、注文者にも最新値を返す', async () => {
    const { target, staff, item } = await fixture();
    const customer = await account(undefined, 'customer');
    for (const soldout of [true, true, false]) {
      const res = await client.store.menu.items[':itemId'].soldout.$patch(
        { param: { itemId: item.id }, json: { soldout } },
        { headers: { authorization: `Bearer ${staff.token}` } },
      );
      expect(res.status).toBe(200);
      const menu = await client.stores[':storeId'].menu.$get(
        { param: { storeId: target.id }, query: {} },
        { headers: { cookie: customer.cookie } },
      );
      expect(menuResponseSchema.parse(await menu.json()).categories[0]?.items[0]?.soldout).toBe(
        soldout,
      );
    }
  });
  it('他店IDと不存在IDは404、他店カテゴリへの登録・移動を防ぐ', async () => {
    const a = await fixture();
    const b = await fixture();
    for (const id of [b.category.id, randomUUID()]) {
      expect((await request(a.staff.cookie, `/categories/${id}`)).status).toBe(404);
      expect(
        (await request(a.staff.cookie, `/categories/${id}`, 'PATCH', { name: '侵入' })).status,
      ).toBe(404);
      expect((await request(a.staff.cookie, `/categories/${id}`, 'DELETE')).status).toBe(404);
      expect(
        (
          await request(a.staff.cookie, '/items', 'POST', {
            name: '侵入',
            price: 1,
            categoryId: id,
          })
        ).status,
      ).toBe(404);
      expect(
        (await request(a.staff.cookie, `/items/${a.item.id}`, 'PATCH', { categoryId: id })).status,
      ).toBe(404);
    }
    for (const id of [b.item.id, randomUUID()]) {
      expect((await request(a.staff.cookie, `/items/${id}`)).status).toBe(404);
      expect((await request(a.staff.cookie, `/items/${id}`, 'PATCH', { price: 1 })).status).toBe(
        404,
      );
      expect(
        (await request(a.staff.cookie, `/items/${id}/soldout`, 'PATCH', { soldout: true })).status,
      ).toBe(404);
      expect((await request(a.staff.cookie, `/items/${id}`, 'DELETE')).status).toBe(404);
    }
    expect(
      managedMenuSchema.parse(await (await request(a.staff.cookie)).json()).categories,
    ).toHaveLength(1);
    expect((await db.select().from(menuItems).where(eq(menuItems.id, b.item.id)))[0]).toMatchObject(
      b.item,
    );
  });
  it('認証・認可は入力検証より先で、所属と権限変更も書込時に再確認する', async () => {
    const { target, staff, service, category } = await fixture();
    expect((await request(undefined, '/items', 'POST', {})).status).toBe(401);
    for (const role of ['customer', 'courier', 'admin'] as const) {
      const user = await account(target.id, role);
      expect((await request(user.cookie, '/items', 'POST', {})).status).toBe(403);
    }
    const noStore = await account();
    expect((await request(noStore.cookie)).status).toBe(403);
    for (const update of [
      { disabled: true },
      { emailVerified: false },
      { role: 'customer' as const },
    ]) {
      await db
        .update(users)
        .set({ disabled: false, emailVerified: true, role: 'store', ...update })
        .where(eq(users.id, staff.id));
      expect((await request(staff.cookie, '/items', 'POST', {})).status).toBe(403);
      await expect(service.deleteCategory(staff.id, target.id, category.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    await db
      .update(users)
      .set({ role: 'store', emailVerified: true, disabled: false })
      .where(eq(users.id, staff.id));
    const other = await store();
    await db
      .update(storeStaffMemberships)
      .set({ storeId: other.id })
      .where(eq(storeStaffMemberships.userId, staff.id));
    await expect(service.deleteCategory(staff.id, target.id, category.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect((await request(staff.cookie, `/categories/${category.id}`, 'DELETE')).status).toBe(404);
    await db.delete(storeStaffMemberships).where(eq(storeStaffMemberships.userId, staff.id));
    expect((await request(staff.cookie)).status).toBe(403);
  });
  it('不正入力、所有権の注入、query、Origin、壊れたJSONを拒否する', async () => {
    const { staff, item, category } = await fixture();
    for (const body of [
      {},
      null,
      [],
      { name: ' ' },
      { name: 'a'.repeat(101) },
      { name: 'a', storeId: randomUUID() },
      { name: 'a', sortOrder: 2147483648 },
      { name: 'a', photoUrl: 'http://example.test/a' },
      { name: 'a', description: 'a'.repeat(1001) },
    ])
      expect((await request(staff.cookie, '/categories', 'POST', body)).status).toBe(400);
    for (const body of [
      {},
      { price: -1 },
      { price: 1.5 },
      { price: 2147483648 },
      { soldout: 'true' },
      { id: randomUUID() },
      { categoryId: 'bad' },
      { photoUrl: 'data:image/png;base64,abc' },
    ])
      expect((await request(staff.cookie, `/items/${item.id}`, 'PATCH', body)).status).toBe(400);
    expect((await request(staff.cookie, `/categories/${category.id}`, 'PATCH', {})).status).toBe(
      400,
    );
    expect((await request(staff.cookie, '/items/nope', 'DELETE')).status).toBe(400);
    for (const query of ['?x=1', '?x=1&x=2', '?='])
      expect((await request(staff.cookie, query)).status).toBe(400);
    expect(
      (
        await request(
          staff.cookie,
          `/items/${item.id}`,
          'DELETE',
          undefined,
          'https://evil.example.test',
        )
      ).status,
    ).toBe(403);
    const malformed = await app.request('/store/menu/categories', {
      method: 'POST',
      headers: { cookie: staff.cookie, origin: config.webURL, 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('cache-control')).toBe('no-store');
  });
  it('R-13 価格変更とカテゴリ連鎖削除後も注文スナップショットを保持する', async () => {
    const { target, staff, category, item } = await fixture();
    const customer = await account(undefined, 'customer');
    const id = randomUUID();
    const quote = {
      storeId: target.id,
      address: '架空住所',
      building: '',
      latitude: 35,
      longitude: 139,
      deliveryNote: '',
      fulfillment: 'hand_delivery' as const,
      dropoffLocation: null,
      subtotal: 500,
      deliveryFee: 300,
      total: 800,
      items: [{ menuItemId: item.id, name: item.name, unitPrice: 500, quantity: 1 }],
    };
    await db.insert(checkoutAttempts).values({
      id,
      userId: customer.id,
      idempotencyKey: randomUUID(),
      requestHash: 'test',
      quote,
    });
    await db
      .insert(orders)
      .values({ id, userId: customer.id, paymentIntentId: `pi_test_${id}`, ...quote });
    await db.insert(orderItems).values({ orderId: id, ...quote.items[0]! });
    try {
      expect(
        (await request(staff.cookie, `/items/${item.id}`, 'PATCH', { name: '新名', price: 999 }))
          .status,
      ).toBe(200);
      expect((await request(staff.cookie, `/categories/${category.id}`, 'DELETE')).status).toBe(
        204,
      );
      expect(
        (await db.select().from(orderItems).where(eq(orderItems.orderId, id)))[0],
      ).toMatchObject({ name: item.name, unitPrice: 500, menuItemId: item.id });
      expect((await db.select().from(orders).where(eq(orders.id, id)))[0]).toMatchObject({
        total: 800,
        subtotal: 500,
      });
      expect(
        (await db.select().from(checkoutAttempts).where(eq(checkoutAttempts.id, id)))[0]?.quote,
      ).toEqual(quote);
    } finally {
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
      await db.delete(orders).where(eq(orders.id, id));
      await db.delete(checkoutAttempts).where(eq(checkoutAttempts.id, id));
    }
  });
});
