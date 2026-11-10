import { fileURLToPath } from 'node:url';

import { storeMeResponseSchema } from '@repo/contract';
import { accounts, createDb, sessions, storeStaffMemberships, stores, users } from '@repo/db';
import { legalDocumentVersions } from '@repo/domain';
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
const app = createApp({ auth, db, config, getClientIp: () => '203.0.113.44' });
const client = testClient(app);
const password = 'fictional-staff-password-123';
const firstStore = '00000000-0000-4000-8000-000000000001';
const secondStore = '00000000-0000-4000-8000-000000000002';

// F17 の発行 API の代替を公開せず、テスト専用 DB に架空の運営発行済み状態を作る。
async function provision(id = 'staff-a', storeId = firstStore) {
  await db.insert(users).values({
    id,
    name: '架空スタッフ',
    email: `${id}@example.test`,
    phoneNumber: '09000000000',
    role: 'store',
    emailVerified: true,
  });
  await db.insert(accounts).values({
    id: `credential-${id}`,
    userId: id,
    accountId: id,
    providerId: 'credential',
    password: await hashPassword(password),
  });
  await db.insert(storeStaffMemberships).values({ userId: id, storeId });
}
async function login(id = 'staff-a') {
  const response = await client.auth['sign-in'].email.$post(
    { json: { email: `${id}@example.test`, password } },
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
  return client.store.me.$get({ query: {} }, { headers: { authorization: `Bearer ${token}` } });
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
  await db.insert(stores).values([
    { id: firstStore, name: '架空店舗 A', address: '架空住所 A', latitude: 0, longitude: 0 },
    { id: secondStore, name: '架空店舗 B', address: '架空住所 B', latitude: 0, longitude: 0 },
  ]);
});
afterAll(async () => {
  await db.$client.end();
});

describe('店舗スタッフ認証（PostgreSQL）', () => {
  it('本人のプロフィールと所属店舗の最小情報を Cookie / 署名 Bearer / RPC で返す', async () => {
    await provision();
    const { token, cookie } = await login();
    for (const headers of [{ cookie }, { authorization: `Bearer ${token}` }]) {
      const response = await client.store.me.$get({ query: {} }, { headers });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body).toEqual({
        user: {
          id: 'staff-a',
          name: '架空スタッフ',
          email: 'staff-a@example.test',
          phoneNumber: '09000000000',
          role: 'store',
          emailVerified: true,
        },
        store: { id: firstStore, name: '架空店舗 A' },
      });
      expect(storeMeResponseSchema.safeParse(body).success).toBe(true);
    }
  });
  it('未認証・偽造・期限切れ・ログアウト後を401にする', async () => {
    expect((await app.request('/store/me')).status).toBe(401);
    await provision();
    const { token, cookie } = await login();
    const [session] = await db.select().from(sessions);
    expect((await me(session?.token ?? '')).status).toBe(401);
    expect(
      (await app.request('/store/me', { headers: { cookie, authorization: 'Bearer invalid' } }))
        .status,
    ).toBe(401);
    await db.update(sessions).set({ expiresAt: new Date(0) });
    expect((await me(token)).status).toBe(401);
    const again = await login();
    const logout = await client.auth['sign-out'].$post(
      {},
      { headers: { authorization: `Bearer ${again.token}` } },
    );
    expect(logout.status).toBe(200);
    expect((await me(again.token)).status).toBe(401);
  });
  it.each(['customer', 'courier', 'admin'] as const)(
    '既存セッションもrole変更 %s を即時403にする',
    async (role) => {
      await provision();
      const { token } = await login();
      await db.update(users).set({ role }).where(eq(users.id, 'staff-a'));
      expect((await me(token)).status).toBe(403);
    },
  );
  it.each([{ disabled: true }, { emailVerified: false }])(
    '停止・未確認への変更を即時403にする %j',
    async (update) => {
      await provision();
      const { token } = await login();
      await db.update(users).set(update).where(eq(users.id, 'staff-a'));
      expect((await me(token)).status).toBe(403);
      const response = await client.auth['sign-in'].email.$post(
        { json: { email: 'staff-a@example.test', password } },
        { headers: { origin: config.webURL } },
      );
      expect(response.status).toBe(403);
    },
  );
  it('所属解除・変更・店舗削除を既存セッションへ即時反映する', async () => {
    await provision();
    const { token } = await login();
    await db.delete(storeStaffMemberships).where(eq(storeStaffMemberships.userId, 'staff-a'));
    expect((await me(token)).status).toBe(403);
    await db.insert(storeStaffMemberships).values({ userId: 'staff-a', storeId: firstStore });
    await db
      .update(storeStaffMemberships)
      .set({ storeId: secondStore })
      .where(eq(storeStaffMemberships.userId, 'staff-a'));
    expect(await (await me(token)).json()).toMatchObject({ store: { id: secondStore } });
    await db.delete(stores).where(eq(stores.id, secondStore));
    expect((await me(token)).status).toBe(403);
    expect(await db.select().from(storeStaffMemberships)).toHaveLength(0);
  });
  it('二店舗と同店舗の複数スタッフを分離し、queryでスコープを変更できない', async () => {
    await provision();
    await provision('staff-b', secondStore);
    await provision('staff-c', firstStore);
    for (const [id, storeId] of [
      ['staff-a', firstStore],
      ['staff-b', secondStore],
      ['staff-c', firstStore],
    ]) {
      const { token } = await login(id);
      expect(await (await me(token)).json()).toMatchObject({
        user: { id },
        store: { id: storeId },
      });
      for (const query of [`storeId=${secondStore}`, 'storeId=invalid', 'userId=staff-b']) {
        expect(
          (
            await app.request(`/store/me?${query}`, {
              headers: { authorization: `Bearer ${token}` },
            })
          ).status,
        ).toBe(400);
      }
    }
  });
  it('DBで所属重複の競合と存在しないuser/storeを拒否する', async () => {
    await provision();
    await db.delete(storeStaffMemberships);
    const results = await Promise.allSettled(
      [firstStore, secondStore].map((storeId) =>
        db.insert(storeStaffMemberships).values({ userId: 'staff-a', storeId }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await db.delete(storeStaffMemberships);
    await expect(
      db.insert(storeStaffMemberships).values({ userId: 'missing', storeId: firstStore }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(storeStaffMemberships)
        .values({ userId: 'staff-a', storeId: '00000000-0000-4000-8000-000000000003' }),
    ).rejects.toThrow();
    await db.insert(storeStaffMemberships).values({ userId: 'staff-a', storeId: firstStore });
    await db.delete(users).where(eq(users.id, 'staff-a'));
    expect(await db.select().from(storeStaffMemberships)).toHaveLength(0);
  });
  it('スタッフのセッションを注文者専用の住所・店舗検索へ流用できない', async () => {
    await provision();
    const { token } = await login();
    for (const path of ['/addresses', `/stores?addressId=${firstStore}`])
      expect(
        (await app.request(path, { headers: { authorization: `Bearer ${token}` } })).status,
      ).toBe(403);
  });
  it('公開スタッフ登録・所属変更・書込APIは提供しない', async () => {
    for (const input of [
      { role: 'store' },
      { storeId: firstStore },
      { storeStaffMemberships: [] },
    ]) {
      const response = await app.request('/auth/sign-up/email', {
        method: 'POST',
        headers: { origin: config.webURL, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: '架空',
          email: 'fiction@example.test',
          password,
          phoneNumber: '09000000000',
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: legalDocumentVersions.terms,
          privacyVersion: legalDocumentVersions.privacy,
          ...input,
        }),
      });
      expect(response.status).toBe(400);
    }
    expect(await db.select().from(users)).toHaveLength(0);
    await provision();
    const { token } = await login();
    for (const path of ['/store/sign-up', '/store/me', '/store/memberships'])
      expect(
        (await app.request(path, { method: 'POST', headers: { authorization: `Bearer ${token}` } }))
          .status,
      ).toBe(404);
  });
});
