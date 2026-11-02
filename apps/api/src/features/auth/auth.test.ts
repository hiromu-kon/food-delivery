import { fileURLToPath } from 'node:url';

import { authUserSchema } from '@repo/contract';
import { accounts, createDb, rateLimits, sessions, users, verifications } from '@repo/db';
import { accountRoles, legalDocumentVersions } from '@repo/domain';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '../../app';
import type { AuthEmail } from '../../integrations/email/sender';
import { requireRole, requireSession } from '../../middleware/auth';
import { createAuthService } from './auth.service';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:15432/food_delivery_test';
// 誤った接続先でテスト用のデータ消去を行わない
if (new URL(databaseUrl).pathname !== '/food_delivery_test')
  throw new Error('TEST_DATABASE_URL は food_delivery_test データベースを指定してください');
const db = createDb(databaseUrl);
const messages: AuthEmail[] = [];
const config = {
  baseURL: 'http://api.example.test',
  webURL: 'http://web.example.test',
  secret: 'test-only-secret-not-for-production-use-0123456789',
  secureCookies: false,
};
const auth = createAuthService(
  db,
  {
    send: (message) => {
      messages.push(message);
      return Promise.resolve();
    },
  },
  config,
);
const session = requireSession(auth, db, [config.webURL, config.baseURL]);
const app = createApp({ auth, db, config, getClientIp: () => '203.0.113.5' })
  .get('/test/admin', session, requireRole(['admin']), (c) => c.json({ ok: true }, 200))
  .get('/test/store', session, requireRole(['store']), (c) => c.json({ ok: true }, 200))
  .get('/test/courier', session, requireRole(['courier']), (c) => c.json({ ok: true }, 200))
  .get('/test/order', session, requireRole(['customer'], true), (c) => c.json({ ok: true }, 200))
  .post('/test/mutation', session, requireRole(['customer']), (c) => c.json({ ok: true }, 200))
  .get('/test/error', () => {
    throw new Error('customer@example.test 09012345678 テストの利用者');
  });
const registration = {
  name: 'テストの利用者',
  email: 'customer@example.test',
  password: 'test-password-123',
  phoneNumber: '09012345678',
  termsAccepted: true,
  privacyAccepted: true,
  termsVersion: legalDocumentVersions.terms,
  privacyVersion: legalDocumentVersions.privacy,
};

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(`${config.baseURL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: config.webURL, ...headers },
    body: JSON.stringify(body),
  });
}
function cookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
async function signUp() {
  const response = await post('/auth/sign-up/email', registration);
  expect(response.status).toBe(200);
  await vi.waitFor(() => expect(messages.length).toBeGreaterThan(0));
  return response;
}
function emailLink(message: AuthEmail | undefined) {
  if (!message) throw new Error('確認用のメールがありません');
  const link = message.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error('確認用のリンクがありません');
  return new URL(link);
}
async function verifiedLogin() {
  await signUp();
  const verify = await app.request(emailLink(messages[0]).href);
  expect(verify.status).toBe(302);
  const response = await post('/auth/sign-in/email', {
    email: registration.email,
    password: registration.password,
  });
  expect(response.status).toBe(200);
  const { user } = z.object({ user: authUserSchema }).parse(await response.json());
  const token = response.headers.get('set-auth-token');
  if (!token) throw new Error('署名付きトークンがありません');
  return { response, user, cookie: cookieFrom(response), token };
}

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`truncate sessions, accounts, verifications, rate_limits, users cascade`);
  messages.length = 0;
});
afterAll(async () => {
  await db.$client.end();
});

describe('認証 API（PostgreSQL）', () => {
  it('R-14 同意を記録して注文者だけを登録し、確認前はログインできない', async () => {
    const response = await signUp();
    expect(await response.json()).toEqual({ status: true });
    expect(response.headers.getSetCookie()).toHaveLength(0);
    const [user] = await db.select().from(users);
    expect(user).toMatchObject({
      role: 'customer',
      disabled: false,
      emailVerified: false,
      termsVersion: legalDocumentVersions.terms,
      privacyVersion: legalDocumentVersions.privacy,
    });
    expect(user?.termsAcceptedAt).toBeInstanceOf(Date);
    const [account] = await db.select().from(accounts);
    expect(account?.password).not.toBe(registration.password);
    expect(account?.password).toBeTruthy();
    const login = await post('/auth/sign-in/email', {
      email: registration.email,
      password: registration.password,
    });
    expect(login.status).toBe(403);
    expect(await login.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
  it.each([
    { password: '1234567' },
    { phoneNumber: '0--------' },
    { termsAccepted: false },
    { privacyAccepted: false },
    { termsVersion: 'old-version' },
    { role: 'admin' },
    { emailVerified: true },
    { disabled: false },
  ])('R-14 弱いパスワード・未同意・古い規約・権限の持ち込みを拒否する %j', async (override) => {
    const response = await post('/auth/sign-up/email', { ...registration, ...override });
    expect(response.status).toBe(400);
    expect(await db.select().from(users)).toHaveLength(0);
    expect(messages).toHaveLength(0);
  });
  it('メール確認後に Hono RPC でログインし、Cookie と署名付き Bearer を使える', async () => {
    await signUp();
    const verify = await app.request(emailLink(messages[0]).href);
    expect(verify.headers.get('location')).toBe(`${config.webURL}/login?verified=true`);
    const client = testClient(app);
    const login = await client.auth['sign-in'].email.$post(
      { json: { email: registration.email, password: registration.password } },
      { headers: { origin: config.webURL } },
    );
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    expect(login.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(login.headers.get('cache-control')).toBe('no-store');
    for (const headers of [
      { cookie },
      { authorization: `Bearer ${login.headers.get('set-auth-token')}` },
    ]) {
      const me = await app.request('/auth/me', { headers });
      expect(me.status).toBe(200);
      expect(await me.json()).toMatchObject({
        user: { email: registration.email, role: 'customer', emailVerified: true },
      });
      expect(
        JSON.stringify(await (await app.request('/auth/me', { headers })).json()),
      ).not.toContain('password');
    }
  });
  it('不正・期限切れ・ログアウト済みのセッションを拒否する', async () => {
    const { cookie, token } = await verifiedLogin();
    expect((await app.request('/auth/me')).status).toBe(401);
    expect(
      (await app.request('/auth/me', { headers: { cookie, authorization: 'Bearer invalid' } }))
        .status,
    ).toBe(401);
    const logout = await testClient(app).auth['sign-out'].$post(
      {},
      { headers: { cookie, origin: config.webURL } },
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(
      (await app.request('/auth/me', { headers: { authorization: `Bearer ${token}` } })).status,
    ).toBe(401);
    const again = await post('/auth/sign-in/email', {
      email: registration.email,
      password: registration.password,
    });
    await db.update(sessions).set({ expiresAt: new Date(0) });
    expect((await app.request('/auth/me', { headers: { cookie: cookieFrom(again) } })).status).toBe(
      401,
    );
  });
  it('R-14 ロール違いを 403 にし、未確認に戻された利用者は注文できない', async () => {
    const { cookie, user } = await verifiedLogin();
    expect((await app.request('/test/admin', { headers: { cookie } })).status).toBe(403);
    expect((await app.request('/test/order', { headers: { cookie } })).status).toBe(200);
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, user.id));
    const response = await app.request('/test/order', { headers: { cookie } });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    for (const role of accountRoles.filter((role) => role !== 'customer')) {
      await db.update(users).set({ role, emailVerified: true }).where(eq(users.id, user.id));
      expect((await app.request('/test/order', { headers: { cookie } })).status).toBe(403);
      expect((await app.request(`/test/${role}`, { headers: { cookie } })).status).toBe(200);
    }
  });
  it('確認メールを再送でき、存在しないメールへの応答は同じになる', async () => {
    await signUp();
    const known = await post('/auth/send-verification-email', { email: registration.email });
    const unknown = await post('/auth/send-verification-email', { email: 'unknown@example.test' });
    expect(known.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(messages).toHaveLength(2);
  });
  it('署名付き Bearer で Origin なしにログアウトできる', async () => {
    const { token } = await verifiedLogin();
    const response = await app.request('/auth/sign-out', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(200);
    expect(
      (await app.request('/auth/me', { headers: { authorization: `Bearer ${token}` } })).status,
    ).toBe(401);
  });
  it('本番設定では Secure Cookie を使う', async () => {
    await verifiedLogin();
    const secureConfig = {
      ...config,
      baseURL: 'https://api.example.test',
      webURL: 'https://web.example.test',
      secureCookies: true,
      cookieDomain: 'example.test',
    };
    const secureAuth = createAuthService(db, { send: () => Promise.resolve() }, secureConfig);
    const secureApp = createApp({
      auth: secureAuth,
      db,
      config: secureConfig,
      getClientIp: () => '203.0.113.6',
    });
    const login = await secureApp.request('https://api.example.test/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: secureConfig.webURL },
      body: JSON.stringify({ email: registration.email, password: registration.password }),
    });
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('__Secure-');
    expect(login.headers.get('set-cookie')).toContain('; Secure');
    expect(login.headers.get('set-cookie')).toContain('Domain=example.test');
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
  });
  it('期限切れのメール確認リンクを拒否する', async () => {
    await signUp();
    const link = emailLink(messages[0]);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000));
      expect((await app.request(link.href)).status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });
  it('エラーの記録に個人情報を含めず、外部のリクエスト ID を採用しない', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await app.request('/test/error', {
        headers: { 'x-request-id': 'private_user_data' },
      });
      expect(response.status).toBe(500);
      expect(response.headers.get('x-request-id')).not.toBe('private_user_data');
      expect(z.uuid().safeParse(response.headers.get('x-request-id')).success).toBe(true);
      const output = JSON.stringify(log.mock.calls);
      for (const personal of [
        registration.name,
        registration.email,
        registration.phoneNumber,
        registration.password,
      ])
        expect(output).not.toContain(personal);
    } finally {
      log.mockRestore();
    }
  });
  it('R-14 停止後は既存セッションも新しいログインも使えない', async () => {
    const { cookie, user } = await verifiedLogin();
    await db.update(users).set({ disabled: true }).where(eq(users.id, user.id));
    expect((await app.request('/auth/me', { headers: { cookie } })).status).toBe(403);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: registration.email,
          password: registration.password,
        })
      ).status,
    ).toBe(403);
  });
  it('重複登録・存在しないメールへの再設定で登録状況を返さない', async () => {
    const first = await signUp();
    const duplicate = await post('/auth/sign-up/email', registration);
    expect(duplicate.status).toBe(first.status);
    expect(await duplicate.json()).toEqual({ status: true });
    const known = await post('/auth/request-password-reset', { email: registration.email });
    const unknown = await post('/auth/request-password-reset', { email: 'unknown@example.test' });
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
  });
  it('再設定トークンを 1 回だけ使い、以前のセッションとパスワードを無効にする', async () => {
    const { cookie, token: oldToken } = await verifiedLogin();
    expect((await post('/auth/request-password-reset', { email: registration.email })).status).toBe(
      200,
    );
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    const token = emailLink(messages[1]).searchParams.get('token');
    expect(token).toBeTruthy();
    const [stored] = await db.select().from(verifications);
    expect(stored?.identifier).not.toContain(token);
    const responses = await Promise.all([
      post('/auth/reset-password', { token, newPassword: 'new-password-123' }),
      post('/auth/reset-password', { token, newPassword: 'new-password-123' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    expect((await app.request('/auth/me', { headers: { cookie } })).status).toBe(401);
    expect(
      (await app.request('/auth/me', { headers: { authorization: `Bearer ${oldToken}` } })).status,
    ).toBe(401);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: registration.email,
          password: registration.password,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: registration.email,
          password: 'new-password-123',
        })
      ).status,
    ).toBe(200);
  });
  it('不正・期限切れの再設定トークンと短い新パスワードを拒否する', async () => {
    await signUp();
    await post('/auth/request-password-reset', { email: registration.email });
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    const token = emailLink(messages[1]).searchParams.get('token');
    expect((await post('/auth/reset-password', { token, newPassword: '1234567' })).status).toBe(
      400,
    );
    await db.update(verifications).set({ expiresAt: new Date(0) });
    expect(
      (await post('/auth/reset-password', { token, newPassword: 'new-password-123' })).status,
    ).toBe(400);
    expect(
      (await post('/auth/reset-password', { token: 'invalid', newPassword: 'new-password-123' }))
        .status,
    ).toBe(400);
    expect((await app.request('/auth/verify-email?token=invalid')).status).toBe(400);
  });
  it('不正な Origin と Cookie の変更要求を拒否し、署名付き Bearer は Origin なしで使える', async () => {
    const { cookie, token } = await verifiedLogin();
    expect(
      (await post('/auth/sign-out', {}, { cookie, origin: 'http://evil.example.test' })).status,
    ).toBe(403);
    expect(
      (await app.request('/test/mutation', { method: 'POST', headers: { cookie } })).status,
    ).toBe(403);
    expect(
      (
        await app.request('/test/mutation', {
          method: 'POST',
          headers: { cookie, authorization: 'Bearer invalid' },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request('/test/mutation', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(200);
    expect((await post('/test/mutation', {}, { cookie })).status).toBe(200);
    expect(
      (await app.request('/auth/update-user', { method: 'POST', headers: { cookie } })).status,
    ).toBe(404);
  });
  it('偽の転送 IP を送ってもログインの試行回数制限を回避できない', async () => {
    let response: Response | undefined;
    for (let index = 0; index < 11; index++)
      response = await post(
        '/auth/sign-in/email',
        { email: 'unknown@example.test', password: 'wrong-password' },
        { 'x-auth-client-ip': `198.51.100.${index}`, 'x-forwarded-for': `198.51.100.${index}` },
      );
    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBeTruthy();
    expect((await db.select().from(rateLimits)).length).toBeGreaterThan(0);
  });
});
