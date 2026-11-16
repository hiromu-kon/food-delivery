import { fileURLToPath } from 'node:url';

import { courierResponseSchema } from '@repo/contract';
import { createDb, sessions, users } from '@repo/db';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapAdmin } from '../admin-auth/admin-bootstrap';

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

describe('配達員管理 API（PostgreSQL）', () => {
  const input = {
    name: '架空配達員',
    email: 'courier@example.test',
    phoneNumber: '09000000001',
    password,
  };
  it('R-14 発行・取得・編集・停止・再開・削除し、停止はログインと既存セッションを拒否する', async () => {
    await provision();
    const { token } = await login();
    const headers = { authorization: `Bearer ${token}` };
    const created = await client.admin.couriers.$post({ json: input }, { headers });
    expect(created.status).toBe(201);
    const { courier } = courierResponseSchema.parse(await created.json());
    expect(Object.keys(courier).sort()).toEqual(['disabled', 'email', 'id', 'name', 'phoneNumber']);
    const param = { id: courier.id };
    expect((await client.admin.couriers[':id'].$get({ param }, { headers })).status).toBe(200);
    expect((await client.admin.couriers.$get({ query: {} }, { headers })).status).toBe(200);
    expect((await client.admin.couriers.$post({ json: input }, { headers })).status).toBe(409);
    const signin = () =>
      client.auth['sign-in'].email.$post(
        { json: { email: input.email, password } },
        { headers: { origin: config.webURL } },
      );
    const signed = await signin();
    expect(signed.status).toBe(200);
    const courierToken = signed.headers.get('set-auth-token');
    const json = {
      name: '編集した配達員',
      email: input.email,
      phoneNumber: input.phoneNumber,
      disabled: true,
    };
    expect((await client.admin.couriers[':id'].$patch({ param, json }, { headers })).status).toBe(
      200,
    );
    expect((await signin()).status).toBe(403);
    expect(
      await db
        .select()
        .from(sessions)
        .where(sql`${sessions.userId} = ${courier.id}`),
    ).toHaveLength(0);
    expect(
      (
        await client.admin.couriers.$get(
          { query: {} },
          { headers: { authorization: `Bearer ${courierToken}` } },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await client.admin.couriers[':id'].$patch(
          { param, json: { ...json, disabled: false } },
          { headers },
        )
      ).status,
    ).toBe(200);
    expect((await signin()).status).toBe(200);
    expect((await client.admin.couriers[':id'].$delete({ param }, { headers })).status).toBe(204);
    expect((await client.admin.couriers[':id'].$get({ param }, { headers })).status).toBe(404);
  });
  it('認可・Origin・入力・対象ロールを検証する', async () => {
    expect((await app.request('/admin/couriers')).status).toBe(401);
    await provision();
    const { token, cookie } = await login();
    const headers = { authorization: `Bearer ${token}` };
    expect(
      (await client.admin.couriers.$post({ json: input }, { headers: { cookie } })).status,
    ).toBe(403);
    const invalid = await app.request('/admin/couriers', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, role: 'admin' }),
    });
    expect(invalid.status).toBe(400);
    const [admin] = await db.select().from(users);
    expect(
      (await client.admin.couriers[':id'].$delete({ param: { id: admin?.id ?? '' } }, { headers }))
        .status,
    ).toBe(404);
    await db.update(users).set({ role: 'customer' });
    expect((await client.admin.couriers.$post({ json: input }, { headers })).status).toBe(403);
  });
});
