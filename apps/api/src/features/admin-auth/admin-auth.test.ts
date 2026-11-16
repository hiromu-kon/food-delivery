import { fileURLToPath } from 'node:url';

import { adminMeResponseSchema } from '@repo/contract';
import { createDb, sessions, users } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapAdmin } from './admin-bootstrap';

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
const app = createApp({ auth, db, config, getClientIp: () => '203.0.113.44' });
const client = testClient(app);
const password = 'fictional-staff-password-123';
async function provision() {
  await bootstrapAdmin(db, {
    name: '架空運営',
    email: 'admin@example.test',
    password,
    phoneNumber: '09000000000',
  });
}
async function login() {
  const response = await client.auth['sign-in'].email.$post(
    { json: { email: 'admin@example.test', password } },
    { headers: { origin: config.webURL } },
  );
  expect(response.status).toBe(200);
  const token = response.headers.get('set-auth-token');
  if (!token) throw new Error('署名付き Bearer がありません');
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  return { token, cookie };
}
function me(token: string) {
  return client.admin.me.$get({ query: {} }, { headers: { authorization: `Bearer ${token}` } });
}
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
  await db.$client.end();
});

describe('運営認証（PostgreSQL）', () => {
  it('R-14 初期運営でログインし、Cookie / Bearer で最小の本人情報だけを取得する', async () => {
    await provision();
    const { token, cookie } = await login();
    for (const headers of [{ cookie }, { authorization: `Bearer ${token}` }]) {
      const response = await client.admin.me.$get({ query: {} }, { headers });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = adminMeResponseSchema.parse(await response.json());
      expect(adminMeResponseSchema.safeParse(body).success).toBe(true);
      expect(Object.keys(body)).toEqual(['user']);
      expect(Object.keys(body.user).sort()).toEqual([
        'email',
        'emailVerified',
        'id',
        'name',
        'phoneNumber',
        'role',
      ]);
    }
  });
  it.each(['customer', 'store', 'courier'] as const)(
    '既存セッションのロール変更 %s を即時拒否する',
    async (role) => {
      await provision();
      const { token } = await login();
      await db.update(users).set({ role });
      expect((await me(token)).status).toBe(403);
    },
  );
  it.each([{ disabled: true }, { emailVerified: false }])(
    'R-14 停止・未確認を即時拒否する %j',
    async (update) => {
      await provision();
      const { token } = await login();
      await db.update(users).set(update);
      expect((await me(token)).status).toBe(403);
      expect(
        (
          await client.auth['sign-in'].email.$post(
            { json: { email: 'admin@example.test', password } },
            { headers: { origin: config.webURL } },
          )
        ).status,
      ).toBe(403);
    },
  );
  it('未認証・偽造・期限切れ・失効・削除済みを401にする', async () => {
    expect((await app.request('/admin/me')).status).toBe(401);
    await provision();
    const { token, cookie } = await login();
    const [session] = await db.select().from(sessions);
    expect((await me(session?.token ?? '')).status).toBe(401);
    expect(
      (await app.request('/admin/me', { headers: { cookie, authorization: 'Bearer invalid' } }))
        .status,
    ).toBe(401);
    await db.update(sessions).set({ expiresAt: new Date(0) });
    expect((await me(token)).status).toBe(401);
    const again = await login();
    await client.auth['sign-out'].$post(
      {},
      { headers: { origin: config.webURL, cookie: again.cookie } },
    );
    expect((await me(again.token)).status).toBe(401);
    const last = await login();
    await db.delete(users);
    expect((await me(last.token)).status).toBe(401);
  });
  it('権限確認を入力検証より先に行い、権限の指定を拒否する', async () => {
    expect((await app.request('/admin/me?role=admin')).status).toBe(401);
    await provision();
    const { token } = await login();
    expect(
      (
        await app.request('/admin/me?userId=other', {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(400);
    await db.update(users).set({ role: 'customer' });
    expect(
      (await app.request('/admin/me?role=admin', { headers: { authorization: `Bearer ${token}` } }))
        .status,
    ).toBe(403);
  });
  it('R-14 初期発行の並行実行は1件だけ成功し、再実行は既存情報を変えない', async () => {
    const results = await Promise.allSettled([provision(), provision()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.select().from(users)).toHaveLength(1);
    await expect(provision()).rejects.toThrow('既に存在');
    await login();
  });
  it('R-14 同じメールの注文者を昇格・上書きしない', async () => {
    await db.insert(users).values({
      id: 'customer',
      name: '架空注文者',
      email: 'admin@example.test',
      phoneNumber: '09000000000',
    });
    await expect(provision()).rejects.toThrow();
    expect(
      await db.select({ role: users.role }).from(users).where(eq(users.id, 'customer')),
    ).toEqual([{ role: 'customer' }]);
  });
});
