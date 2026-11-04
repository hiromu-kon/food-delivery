import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  storeAcceptanceResponseSchema,
  storeSearchResponseSchema,
  menuResponseSchema,
} from '@repo/contract';
import { addresses, createDb, sessions, storeStaffMemberships, stores, users } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';
import { createStoreAcceptanceService } from './store-acceptance.service';

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
function patch(cookie?: string, body: unknown = { isAcceptingOrders: false }, query = '') {
  return app.request(`/store/acceptance${query}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: config.webURL,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function saved(id: string) {
  return (await db.select().from(stores).where(eq(stores.id, id)))[0];
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

describe('受付切替 API（実 PostgreSQL）', () => {
  it('R-09 Cookie / 署名 Bearer / RPC で所属店舗だけを false・true にし、同値の再送も成功する', async () => {
    const target = await store();
    const other = await store();
    const staff = await account(target.id);
    const otherStaff = await account(other.id);
    for (const isAcceptingOrders of [false, false, true, true]) {
      const response = await client.store.acceptance.$patch(
        { json: { isAcceptingOrders } },
        { headers: { authorization: `Bearer ${staff.token}` } },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body: unknown = await response.json();
      expect(body).toEqual({ store: { id: target.id, isAcceptingOrders } });
      expect(storeAcceptanceResponseSchema.parse(body)).toEqual(body);
      expect(await saved(target.id)).toEqual({ ...target, isAcceptingOrders });
      expect(await saved(other.id)).toEqual(other);
    }
    expect((await patch(staff.cookie)).status).toBe(200);
    expect((await patch(otherStaff.cookie)).status).toBe(200);
    expect((await saved(target.id))?.isAcceptingOrders).toBe(false);
    expect((await saved(other.id))?.isAcceptingOrders).toBe(false);
  });
  it('R-09 切替後も圏内一覧に残り canOrder が一致し、メニューも最新の受付状態を返す', async () => {
    const target = await store();
    const staff = await account(target.id);
    const customer = await account(undefined, 'customer');
    const [address] = await db
      .insert(addresses)
      .values({ userId: customer.id, address: '架空お届け先', latitude: 35, longitude: 139 })
      .returning();
    if (!address) throw new Error('fixture failed');
    for (const isAcceptingOrders of [false, true]) {
      expect((await patch(staff.cookie, { isAcceptingOrders })).status).toBe(200);
      const list = await client.stores.$get(
        { query: { addressId: address.id } },
        { headers: { cookie: customer.cookie } },
      );
      expect(list.status).toBe(200);
      expect(
        storeSearchResponseSchema
          .parse(await list.json())
          .stores.find((row) => row.id === target.id),
      ).toMatchObject({ isAcceptingOrders, canOrder: isAcceptingOrders });
      const menu = await client.stores[':storeId'].menu.$get(
        { param: { storeId: target.id }, query: {} },
        { headers: { cookie: customer.cookie } },
      );
      expect(menu.status).toBe(200);
      expect(menuResponseSchema.parse(await menu.json()).store.isAcceptingOrders).toBe(
        isAcceptingOrders,
      );
    }
  });
  it('未認証・偽造 Bearer・期限切れは401で書き換えない', async () => {
    const target = await store();
    const staff = await account(target.id);
    expect((await patch()).status).toBe(401);
    expect(
      (
        await app.request('/store/acceptance', {
          method: 'PATCH',
          headers: { cookie: staff.cookie, authorization: 'Bearer invalid' },
          body: '{',
        })
      ).status,
    ).toBe(401);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(sessions.userId, staff.id));
    expect((await patch(staff.cookie)).status).toBe(401);
    expect(await saved(target.id)).toEqual(target);
  });
  it.each(['customer', 'courier', 'admin'] as const)(
    '所属があっても %s は入力検証前に403で拒否する',
    async (role) => {
      const target = await store();
      const user = await account(target.id, role);
      expect((await patch(user.cookie, {})).status).toBe(403);
      expect(await saved(target.id)).toEqual(target);
    },
  );
  it.each([{ disabled: true }, { emailVerified: false }, { role: 'customer' as const }])(
    '既存セッションでも権限変更 %j を即時反映する',
    async (update) => {
      const target = await store();
      const staff = await account(target.id);
      await db.update(users).set(update).where(eq(users.id, staff.id));
      expect((await patch(staff.cookie)).status).toBe(403);
      expect(await saved(target.id)).toEqual(target);
    },
  );
  it('所属なし・解除・店舗削除は403、所属変更後は新しい店舗だけを更新する', async () => {
    const target = await store();
    const other = await store();
    const staff = await account();
    expect((await patch(staff.cookie)).status).toBe(403);
    await db.insert(storeStaffMemberships).values({ userId: staff.id, storeId: target.id });
    await db
      .update(storeStaffMemberships)
      .set({ storeId: other.id })
      .where(eq(storeStaffMemberships.userId, staff.id));
    expect((await patch(staff.cookie)).status).toBe(200);
    expect(await saved(target.id)).toEqual(target);
    expect((await saved(other.id))?.isAcceptingOrders).toBe(false);
    await db.delete(storeStaffMemberships).where(eq(storeStaffMemberships.userId, staff.id));
    expect((await patch(staff.cookie)).status).toBe(403);
    await db.insert(storeStaffMemberships).values({ userId: staff.id, storeId: target.id });
    await db.delete(stores).where(eq(stores.id, target.id));
    expect((await patch(staff.cookie)).status).toBe(403);
  });
  it('欠落・型不正・未知キー・他店ID・query・壊れたJSONを拒否し全店舗を保持する', async () => {
    const target = await store();
    const other = await store();
    const staff = await account(target.id);
    for (const body of [
      {},
      null,
      [],
      true,
      { isAcceptingOrders: 'false' },
      { isAcceptingOrders: 0 },
      { isAcceptingOrders: null },
      { isAcceptingOrders: false, storeId: other.id },
      { isAcceptingOrders: false, userId: randomUUID() },
      { isAcceptingOrders: false, extra: true },
    ]) {
      const response = await patch(staff.cookie, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    for (const query of [`?storeId=${other.id}`, '?extra=1&extra=2', '?='])
      expect((await patch(staff.cookie, { isAcceptingOrders: false }, query)).status).toBe(400);
    for (const body of ['', '{'])
      expect(
        (
          await app.request('/store/acceptance', {
            method: 'PATCH',
            headers: {
              cookie: staff.cookie,
              origin: config.webURL,
              'content-type': 'application/json',
            },
            body,
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await app.request(`/store/${other.id}/acceptance`, {
          method: 'PATCH',
          headers: { cookie: staff.cookie, origin: config.webURL },
        })
      ).status,
    ).toBe(404);
    expect(await saved(target.id)).toEqual(target);
    expect(await saved(other.id)).toEqual(other);
  });
  it('Cookie 書込は許可 Origin が必須で、本文なしも変更しない', async () => {
    const target = await store();
    const staff = await account(target.id);
    for (const origin of [undefined, 'https://evil.example.test', config.webURL]) {
      const response = await app.request('/store/acceptance', {
        method: 'PATCH',
        headers: { cookie: staff.cookie, ...(origin ? { origin } : {}) },
      });
      expect(response.status).toBe(origin === config.webURL ? 400 : 403);
    }
    expect(await saved(target.id)).toEqual(target);
  });
  it('DB更新自身も古い所属・権限での書込を拒否する', async () => {
    const target = await store();
    const other = await store();
    const staff = await account(target.id);
    const service = createStoreAcceptanceService(db);
    await expect(service.update(staff.id, other.id, false)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    for (const update of [
      { disabled: true },
      { emailVerified: false },
      { role: 'admin' as const },
    ]) {
      await db
        .update(users)
        .set({ disabled: false, emailVerified: true, role: 'store', ...update })
        .where(eq(users.id, staff.id));
      await expect(service.update(staff.id, target.id, false)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    await db
      .update(users)
      .set({ role: 'store', emailVerified: true, disabled: false })
      .where(eq(users.id, staff.id));
    await db
      .update(storeStaffMemberships)
      .set({ storeId: other.id })
      .where(eq(storeStaffMemberships.userId, staff.id));
    await expect(service.update(staff.id, target.id, false)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await db.delete(storeStaffMemberships).where(eq(storeStaffMemberships.userId, staff.id));
    await expect(service.update(staff.id, target.id, false)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(await saved(target.id)).toEqual(target);
    expect(await saved(other.id)).toEqual(other);
  });
});
