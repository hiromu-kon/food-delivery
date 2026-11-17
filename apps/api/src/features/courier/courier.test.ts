import { fileURLToPath } from 'node:url';

import { courierMeSchema } from '@repo/contract';
import { accounts, couriers, createDb, sessions, users } from '@repo/db';
import { hashPassword } from 'better-auth/crypto';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';

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
const app = createApp({ auth, db, config, getClientIp: () => '203.0.113.59' });
const client = testClient(app);
const password = 'fictional-courier-password-123';
async function provision(id = 'courier-a') {
  await db.insert(users).values({
    id,
    name: '架空配達員',
    email: `${id}@example.test`,
    phoneNumber: '09000000000',
    role: 'courier',
    emailVerified: true,
  });
  await db.insert(accounts).values({
    id: `credential-${id}`,
    userId: id,
    accountId: id,
    providerId: 'credential',
    password: await hashPassword(password),
  });
  await db.insert(couriers).values({ userId: id });
}
function signIn(id = 'courier-a', suppliedPassword = password) {
  return client.auth['sign-in'].email.$post(
    { json: { email: `${id}@example.test`, password: suppliedPassword } },
    { headers: { origin: config.webURL } },
  );
}
async function login(id = 'courier-a') {
  const response = await signIn(id);
  expect(response.status).toBe(200);
  const token = response.headers.get('set-auth-token');
  if (!token) throw new Error('署名付き Bearer がありません');
  return token;
}
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
const me = (token: string) => client.courier.me.$get({}, { headers: headers(token) });
const update = (token: string, isAvailable: boolean) =>
  client.courier.availability.$patch({ json: { isAvailable } }, { headers: headers(token) });

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`truncate users, rate_limits cascade`);
});
afterAll(async () => {
  await db.execute(sql`truncate users, rate_limits cascade`);
  await db.$client.end();
});

describe('F-13 配達員ログイン・稼働状態（PostgreSQL）', () => {
  it('R-14 運営発行済み配達員がログインし本人情報と休止中の初期値を取得する', async () => {
    await provision();
    const token = await login();
    const response = await me(token);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = courierMeSchema.parse(await response.json());
    expect(body.user).toMatchObject({ id: 'courier-a', role: 'courier', name: '架空配達員' });
    expect(body.courier).toEqual({ isAvailable: false });
    expect((await signIn('courier-a', 'incorrect-password')).status).toBe(401);
  });
  it('本人の稼働状態だけを永続化し、再送と再ログインで同じ結果になる', async () => {
    await provision();
    await provision('courier-b');
    const token = await login();
    expect((await update(token, true)).status).toBe(200);
    expect((await update(token, true)).status).toBe(200);
    expect(courierMeSchema.parse(await (await me(await login())).json()).courier.isAvailable).toBe(
      true,
    );
    expect(
      (await db.select().from(couriers).where(eq(couriers.userId, 'courier-b')))[0]?.isAvailable,
    ).toBe(false);
    expect(await (await update(token, false)).json()).toEqual({ isAvailable: false });
    const invalid = await app.request('/courier/availability', {
      method: 'PATCH',
      headers: { ...headers(token), 'content-type': 'application/json' },
      body: JSON.stringify({ isAvailable: true, userId: 'courier-b' }),
    });
    expect(invalid.status).toBe(400);
    expect(
      (
        await app.request('/courier/availability', {
          method: 'PATCH',
          headers: { ...headers(token), 'content-type': 'application/json' },
          body: '{"isAvailable":"true"}',
        })
      ).status,
    ).toBe(400);
  });
  it('R-14 停止された配達員はログインできず既存セッションの取得・更新も拒否する', async () => {
    await provision();
    const token = await login();
    await db.update(users).set({ disabled: true }).where(eq(users.id, 'courier-a'));
    expect((await signIn()).status).toBe(403);
    expect((await me(token)).status).toBe(403);
    expect((await update(token, true)).status).toBe(403);
    expect((await db.select().from(couriers))[0]?.isAvailable).toBe(false);
  });
  it.each(['customer', 'store', 'admin'] as const)(
    '現在のロール %s を取得・更新の両方で拒否する',
    async (role) => {
      await provision();
      const token = await login();
      await db.update(users).set({ role }).where(eq(users.id, 'courier-a'));
      expect((await me(token)).status).toBe(403);
      expect((await update(token, true)).status).toBe(403);
    },
  );
  it('配達員登録解除とメール未確認を既存セッションにも反映する', async () => {
    await provision();
    const token = await login();
    await db.update(users).set({ emailVerified: false });
    expect((await me(token)).status).toBe(403);
    expect((await update(token, true)).status).toBe(403);
    await db.update(users).set({ emailVerified: true });
    await db.delete(couriers);
    expect((await me(token)).status).toBe(403);
    expect((await update(token, true)).status).toBe(403);
  });
  it('未認証・偽造・期限切れ・ログアウト後は取得も更新も401になる', async () => {
    for (const token of ['', 'forged']) {
      expect((await me(token)).status).toBe(401);
      expect((await update(token, true)).status).toBe(401);
    }
    await provision();
    const token = await login();
    await db.update(sessions).set({ expiresAt: new Date(0) });
    expect((await me(token)).status).toBe(401);
    expect((await update(token, true)).status).toBe(401);
    const again = await login();
    expect((await client.auth['sign-out'].$post({}, { headers: headers(again) })).status).toBe(200);
    expect((await me(again)).status).toBe(401);
    expect((await update(again, true)).status).toBe(401);
  });
  it('Cookie更新は信頼するOriginだけを受け入れ無効Bearerにフォールバックしない', async () => {
    await provision();
    const response = await signIn();
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const request = (origin?: string, authorization?: string) =>
      app.request('/courier/availability', {
        method: 'PATCH',
        headers: {
          cookie,
          'content-type': 'application/json',
          ...(origin && { origin }),
          ...(authorization && { authorization }),
        },
        body: '{"isAvailable":true}',
      });
    expect((await request()).status).toBe(403);
    expect((await request('http://evil.example.test')).status).toBe(403);
    expect((await request(config.webURL)).status).toBe(200);
    expect((await request(config.webURL, 'Bearer forged')).status).toBe(401);
  });
});
