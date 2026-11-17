import { fileURLToPath } from 'node:url';

import { managedStoreSchema, managedStaffSchema } from '@repo/contract';
import {
  accounts,
  createDb,
  stores,
  users,
  storeStaffMemberships,
  menuCategories,
  checkoutAttempts,
  orders,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import type { EmailSender } from '../../integrations/email/sender';
import { GeocodingError, type Geocoder } from '../../integrations/maps/geocoder';
import { bootstrapAdmin } from '../admin-auth/admin-bootstrap';
import { createAuthService } from '../auth/auth.service';
import { createStoreAdminRepository } from './store-admin.repository';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/food_delivery_test')
  throw new Error('専用テストDBを指定してください');
const db = createDb(databaseUrl);
const config = {
  baseURL: 'http://api.example.test',
  webURL: 'http://web.example.test',
  secret: 'test-only-secret-not-for-production-use-0123456789',
  secureCookies: false,
};
const send = vi.fn<EmailSender['send']>(() => Promise.resolve());
const auth = createAuthService(db, { send }, config);
const geocode = vi
  .fn<Geocoder['geocode']>()
  .mockResolvedValue({ latitude: 35.68, longitude: 139.76 });
const app = createApp({
  auth,
  db,
  config,
  geocoder: { geocode },
  getClientIp: () => '203.0.113.75',
});
const password = 'fictional-password-123';
const input = {
  name: '架空店舗',
  address: '架空住所1-2-3',
  deliveryRadiusMeters: 2500,
  minimumOrderAmount: 1000,
};
const staff = {
  name: '架空スタッフ',
  email: 'staff@example.test',
  password,
  phoneNumber: '09000000000',
};
let token: string;
let cookie: string;
async function request(
  path = '',
  method = 'GET',
  json?: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${token}` },
) {
  return app.request(`/admin/stores${path}`, {
    method,
    headers: { ...headers, 'content-type': 'application/json' },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
}
async function create() {
  const response = await request('', 'POST', input);
  expect(response.status).toBe(201);
  return managedStoreSchema.parse(await response.json()).store;
}
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`truncate users, stores, rate_limits cascade`);
  geocode.mockReset().mockResolvedValue({ latitude: 35.68, longitude: 139.76 });
  send.mockClear();
  await bootstrapAdmin(db, { ...staff, name: '架空運営', email: 'admin@example.test' });
  const response = await app.request('/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: config.webURL, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.test', password }),
  });
  token = response.headers.get('set-auth-token') ?? '';
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  expect(token).not.toBe('');
});
afterAll(async () => {
  await db.$client.end();
});

describe('運営の店舗管理（PostgreSQL）', () => {
  it('R-01 店舗を登録・一覧・取得・編集し、住所と座標、半径、最低金額を保存する', async () => {
    const store = await create();
    expect(store).toMatchObject({
      ...input,
      latitude: 35.68,
      longitude: 139.76,
      isAcceptingOrders: false,
    });
    expect(geocode).toHaveBeenCalledWith(input.address);
    const list = await request();
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect(await list.json()).toEqual({ stores: [store] });
    expect((await request(`/${store.id}`)).status).toBe(200);
    geocode.mockResolvedValueOnce({ latitude: 36, longitude: 140 });
    const changed = await request(`/${store.id}`, 'PATCH', {
      address: '架空住所4-5-6',
      deliveryRadiusMeters: 4000,
      minimumOrderAmount: 2000,
      isAcceptingOrders: true,
    });
    expect(managedStoreSchema.parse(await changed.json()).store).toMatchObject({
      latitude: 36,
      longitude: 140,
      deliveryRadiusMeters: 4000,
      minimumOrderAmount: 2000,
    });
    await request(`/${store.id}`, 'PATCH', { description: '説明' });
    expect(geocode).toHaveBeenCalledTimes(2);
    expect((await request(`/${store.id}`, 'DELETE')).status).toBe(204);
    expect((await request(`/${store.id}`)).status).toBe(404);
  });
  it('R-01 地図の失敗では店舗を作成せず、編集前の住所と座標を保持する', async () => {
    geocode.mockRejectedValueOnce(new GeocodingError('ADDRESS_NOT_FOUND'));
    expect((await request('', 'POST', input)).status).toBe(422);
    expect(await db.select().from(stores)).toHaveLength(0);
    const store = await create();
    geocode.mockRejectedValueOnce(new GeocodingError('GEOCODING_UNAVAILABLE'));
    expect((await request(`/${store.id}`, 'PATCH', { address: '変更住所' })).status).toBe(503);
    expect(managedStoreSchema.parse(await (await request(`/${store.id}`)).json()).store).toEqual(
      store,
    );
  });
  it('未認証・他ロール・停止・未確認を全操作で拒否し、入力検証より先に認可する', async () => {
    const store = await create();
    const actions = [
      ['', 'GET', undefined],
      ['', 'POST', input],
      [`/${store.id}`, 'GET', undefined],
      [`/${store.id}`, 'PATCH', { name: '変更' }],
      [`/${store.id}`, 'DELETE', undefined],
      [`/${store.id}/staff`, 'POST', staff],
    ] as const;
    for (const [path, method, json] of actions)
      expect((await request(path, method, json, { authorization: '' })).status).toBe(401);
    for (const change of [
      { role: 'customer' },
      { role: 'store' },
      { role: 'courier' },
      { disabled: true },
      { emailVerified: false },
    ] as const) {
      await db
        .update(users)
        .set({ role: 'admin', disabled: false, emailVerified: true, ...change });
      for (const [path, method, json] of actions)
        expect((await request(path, method, json)).status).toBe(403);
    }
    expect(await db.select().from(stores)).toHaveLength(1);
    expect(await db.select().from(storeStaffMemberships)).toHaveLength(0);
  });
  it('Cookie更新はOriginを要求し、不正な入力・クエリ・IDを拒否する', async () => {
    expect((await request('', 'POST', input, { cookie })).status).toBe(403);
    const ok = await app.request('/admin/stores', {
      method: 'POST',
      headers: { cookie, origin: config.webURL, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(ok.status).toBe(201);
    for (const change of [
      { deliveryRadiusMeters: 0 },
      { deliveryRadiusMeters: -1 },
      { minimumOrderAmount: -1 },
      { minimumOrderAmount: 0.5 },
      { minimumOrderAmount: 2147483648 },
      { name: ' ' },
      { address: '\0' },
      { latitude: 0 },
      { photoUrl: 'http://example.test/photo' },
      { role: 'admin' },
    ])
      expect((await request('', 'POST', { ...input, ...change })).status).toBe(400);
    expect((await request('?userId=other')).status).toBe(400);
    expect((await request('/invalid')).status).toBe(400);
    const store = managedStoreSchema.parse(await ok.json()).store;
    expect((await request(`/${store.id}`, 'PATCH', {})).status).toBe(400);
    expect(
      (await request('/00000000-0000-4000-8000-000000000099/staff', 'POST', staff)).status,
    ).toBe(404);
  });
  it('スタッフの資格情報と所属を原子的に発行し、本人のメール確認後に店舗へログインできる', async () => {
    const store = await create();
    const response = await request(`/${store.id}/staff`, 'POST', staff);
    expect(response.status).toBe(201);
    const issued = managedStaffSchema.parse(await response.json()).staff;
    expect(issued).toMatchObject({ email: staff.email, role: 'store', emailVerified: false });
    expect(await db.select().from(storeStaffMemberships)).toEqual([
      { userId: issued.id, storeId: store.id },
    ]);
    const [credential] = await db.select().from(accounts).where(eq(accounts.userId, issued.id));
    expect(credential?.password).not.toBe(password);
    const signIn = () =>
      app.request('/auth/sign-in/email', {
        method: 'POST',
        headers: { origin: config.webURL, 'content-type': 'application/json' },
        body: JSON.stringify({ email: staff.email, password }),
      });
    expect((await signIn()).status).toBe(403);
    const verification = await app.request('/auth/send-verification-email', {
      method: 'POST',
      headers: { origin: config.webURL, 'content-type': 'application/json' },
      body: JSON.stringify({ email: staff.email }),
    });
    expect(verification.status).toBe(200);
    const message = send.mock.calls.at(-1)?.[0];
    expect(message?.to).toBe(staff.email);
    const url = message?.text.split('\n').at(-1);
    if (!url) throw new Error('確認メールがありません');
    const verified = await app.request(url);
    expect(verified.status).toBe(302);
    const login = await signIn();
    expect(login.status).toBe(200);
    const me = await app.request('/store/me', {
      headers: { authorization: `Bearer ${login.headers.get('set-auth-token')}` },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ store: { id: store.id } });
    expect((await request(`/${store.id}`, 'DELETE')).status).toBe(204);
    expect(
      (
        await app.request('/store/me', {
          headers: { authorization: `Bearer ${login.headers.get('set-auth-token')}` },
        })
      ).status,
    ).toBe(403);
  });
  it('同じメールの同時発行は1件だけ成功し、既存利用者を上書きしない', async () => {
    const store = await create();
    const results = await Promise.all([
      request(`/${store.id}/staff`, 'POST', staff),
      request(`/${store.id}/staff`, 'POST', { ...staff, email: 'STAFF@example.test' }),
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(storeStaffMemberships)).toHaveLength(1);
    expect(
      (await request(`/${store.id}/staff`, 'POST', { ...staff, email: 'admin@example.test' }))
        .status,
    ).toBe(409);
    expect((await request(`/${store.id}/staff`, 'POST', { ...staff, role: 'admin' })).status).toBe(
      400,
    );
    expect(await db.select().from(users)).toHaveLength(2);
  });
  it('削除はメニューと所属を除去し、スタッフアカウントを残す', async () => {
    const store = await create();
    await request(`/${store.id}/staff`, 'POST', staff);
    await db.insert(menuCategories).values({ storeId: store.id, name: 'カテゴリ' });
    expect((await request(`/${store.id}`, 'DELETE')).status).toBe(204);
    expect(await db.select().from(menuCategories)).toHaveLength(0);
    expect(await db.select().from(storeStaffMemberships)).toHaveLength(0);
    expect(await db.select().from(users)).toHaveLength(2);
  });
  it('注文履歴のある店舗の削除を409にし、履歴と店舗を残す', async () => {
    const store = await create();
    const [admin] = await db.select().from(users);
    if (!admin) throw new Error('運営がありません');
    const quote = {
      storeId: store.id,
      address: '架空住所',
      building: '',
      latitude: 35,
      longitude: 139,
      deliveryNote: '',
      fulfillment: 'hand_delivery' as const,
      dropoffLocation: null,
      subtotal: 1000,
      deliveryFee: 300,
      total: 1300,
      items: [],
    };
    const [attempt] = await db
      .insert(checkoutAttempts)
      .values({ userId: admin.id, idempotencyKey: crypto.randomUUID(), requestHash: 'test', quote })
      .returning();
    if (!attempt) throw new Error('試行がありません');
    await db
      .insert(orders)
      .values({ ...quote, id: attempt.id, userId: admin.id, paymentIntentId: 'pi_fictional' });
    expect((await request(`/${store.id}`, 'DELETE')).status).toBe(409);
    expect(await db.select().from(stores)).toHaveLength(1);
    expect(await db.select().from(orders)).toHaveLength(1);
  });
  it('住所解決中に停止された運営の更新を保存しない', async () => {
    const store = await create();
    geocode.mockImplementationOnce(async () => {
      await db.update(users).set({ disabled: true });
      return { latitude: 36, longitude: 140 };
    });
    expect((await request(`/${store.id}`, 'PATCH', { address: '変更住所' })).status).toBe(403);
    expect((await db.select().from(stores))[0]).toEqual(store);
  });
  it('リポジトリでも現在の運営権限を再検証する', async () => {
    const [admin] = await db.select().from(users);
    if (!admin) throw new Error('運営がありません');
    await db.update(users).set({ disabled: true });
    await expect(
      createStoreAdminRepository(db).create(admin.id, { ...input, latitude: 0, longitude: 0 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(stores)).toHaveLength(0);
  });
});
