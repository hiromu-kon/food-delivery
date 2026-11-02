import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { addressSchema } from '@repo/contract';
import { addresses, createDb, sessions, users } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '../../app';
import { createOpenCageGeocoder } from '../../integrations/maps/opencage';
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
const success = {
  status: { code: 200 },
  results: [
    {
      geometry: { lat: 35.681236, lng: 139.767125 },
      components: { _type: 'building', country_code: 'jp' },
    },
  ],
};
const http = vi.fn<typeof fetch>();
const app = createApp({
  auth,
  db,
  config,
  getClientIp: () => '203.0.113.5',
  geocoder: createOpenCageGeocoder({ apiKey: 'test-key', fetch: http, timeoutMs: 15 }),
});
const input = {
  address: '東京都千代田区丸の内1丁目9-1',
  building: 'テストビル101',
  deliveryNote: 'インターホンを押してください',
};

async function seed(role: 'customer' | 'store' | 'courier' | 'admin' = 'customer') {
  const id = randomUUID();
  const token = randomUUID();
  await db.insert(users).values({
    id,
    name: '住所テスト',
    email: `${id}@example.test`,
    phoneNumber: '09012345678',
    role,
    emailVerified: false,
  });
  await db
    .insert(sessions)
    .values({ id: randomUUID(), userId: id, token, expiresAt: new Date(Date.now() + 3600000) });
  // Cookie の署名は認証ライブラリに任せ、実ログインなしでもサーバーの認証APIでセッションを検証する。
  return { id, token };
}
async function cookieFor(token: string) {
  // better-auth の bearer plugin が使う署名付きトークンは Cookie の署名と同一。
  const { createHmac } = await import('node:crypto');
  const signature = createHmac('sha256', config.secret).update(token).digest('base64');
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}
function request(path = '', method = 'GET', body?: unknown, cookie?: string) {
  return app.request(`${config.baseURL}/addresses${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: config.webURL,
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function create(cookie: string) {
  const response = await request('', 'POST', input, cookie);
  expect(response.status).toBe(201);
  return z.object({ address: addressSchema }).parse(await response.json()).address;
}

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../../../packages/db/migrations', import.meta.url),
    ),
  });
});
beforeEach(async () => {
  await db.execute(sql`truncate sessions, accounts, verifications, rate_limits, users cascade`);
  http.mockReset().mockImplementation(() => Promise.resolve(Response.json(success)));
});
afterAll(async () => {
  await db.$client.end();
});

describe('お届け先 API（PostgreSQL + HTTP adapter）', () => {
  it('R-15 本人の住所CRUDで座標と建物と100文字の配達メモを保存する', async () => {
    const owner = await seed();
    const cookie = await cookieFor(owner.token);
    // Hono RPC の入力・レスポンス型も contract から導出される。
    const rpc = testClient(app);
    const response = await rpc.addresses.$post(
      { json: { ...input, deliveryNote: 'あ'.repeat(100) } },
      { headers: { cookie, origin: config.webURL } },
    );
    expect(response.status).toBe(201);
    const saved = z.object({ address: addressSchema }).parse(await response.json()).address;
    expect(saved).toMatchObject({
      latitude: 35.681236,
      longitude: 139.767125,
      deliveryNote: 'あ'.repeat(100),
    });
    expect(saved).not.toHaveProperty('userId');
    expect((await db.select().from(addresses))[0]).toMatchObject({ userId: owner.id, ...saved });
    expect(await (await request('', 'GET', undefined, cookie)).json()).toEqual({
      addresses: [saved],
    });
    expect(await (await request(`/${saved.id}`, 'GET', undefined, cookie)).json()).toEqual({
      address: saved,
    });
    http.mockResolvedValueOnce(
      Response.json({
        ...success,
        results: [{ ...success.results[0], geometry: { lat: 34.7, lng: 135.5 } }],
      }),
    );
    expect(
      (await request(`/${saved.id}`, 'PATCH', { address: '大阪府大阪市北区梅田1-1' }, cookie))
        .status,
    ).toBe(200);
    expect((await db.select().from(addresses))[0]).toMatchObject({
      address: '大阪府大阪市北区梅田1-1',
      building: input.building,
      deliveryNote: 'あ'.repeat(100),
      latitude: 34.7,
      longitude: 135.5,
    });
    expect((await request(`/${saved.id}`, 'DELETE', undefined, cookie)).status).toBe(200);
    expect((await request(`/${saved.id}`, 'GET', undefined, cookie)).status).toBe(404);
    expect(await db.select().from(addresses)).toEqual([]);
  });

  it('R-15 PATCHは指定項目だけを変更し住所が同じなら地図APIを呼ばない', async () => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    http.mockClear();
    expect(
      (await request(`/${saved.id}`, 'PATCH', { deliveryNote: '玄関前で呼んでください' }, cookie))
        .status,
    ).toBe(200);
    expect(
      (await request(`/${saved.id}`, 'PATCH', { address: input.address, building: '' }, cookie))
        .status,
    ).toBe(200);
    expect((await request(`/${saved.id}`, 'PATCH', {}, cookie)).status).toBe(400);
    expect((await request(`/${saved.id}`, 'PATCH', { userId: 'other' }, cookie)).status).toBe(400);
    expect(http).not.toHaveBeenCalled();
    expect((await db.select().from(addresses))[0]).toMatchObject({
      ...saved,
      building: '',
      deliveryNote: '玄関前で呼んでください',
    });
  });

  it('他人の一覧・取得・変更・削除で行を露出せず地図APIも呼ばない', async () => {
    const owner = await seed();
    const saved = await create(await cookieFor(owner.token));
    const other = await seed();
    const cookie = await cookieFor(other.token);
    http.mockClear();
    expect(await (await request('', 'GET', undefined, cookie)).json()).toEqual({ addresses: [] });
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const response = await request(
        `/${saved.id}`,
        method,
        method === 'PATCH' ? input : undefined,
        cookie,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        code: 'NOT_FOUND',
        message: 'お届け先が見つかりません',
      });
    }
    expect(http).not.toHaveBeenCalled();
    expect((await db.select().from(addresses))[0]).toMatchObject(saved);
  });

  it('認証なし・停止・他roleを全CRUDで拒否する', async () => {
    const owner = await seed();
    const saved = await create(await cookieFor(owner.token));
    const disabled = await seed();
    await db.update(users).set({ disabled: true }).where(eq(users.id, disabled.id));
    const cookies: { cookie?: string; status: number }[] = [
      { status: 401 },
      { cookie: await cookieFor(disabled.token), status: 403 },
    ];
    for (const role of ['store', 'courier', 'admin'] as const)
      cookies.push({ cookie: await cookieFor((await seed(role)).token), status: 403 });
    http.mockClear();
    for (const { cookie, status } of cookies) {
      for (const [path, method] of [
        ['', 'GET'],
        ['', 'POST'],
        [`/${saved.id}`, 'GET'],
        [`/${saved.id}`, 'PATCH'],
        [`/${saved.id}`, 'DELETE'],
      ]) {
        expect(
          (
            await request(
              path,
              method,
              ['POST', 'PATCH'].includes(method ?? '') ? input : undefined,
              cookie,
            )
          ).status,
        ).toBe(status);
      }
    }
    expect(http).not.toHaveBeenCalled();
    expect((await db.select().from(addresses))[0]).toMatchObject(saved);
  });

  it('R-15 未知キー・偽の所有者や座標・空住所・型違い・長すぎる入力を保存前に拒否する', async () => {
    const cookie = await cookieFor((await seed()).token);
    for (const body of [
      { ...input, userId: 'someone' },
      { ...input, latitude: 1, longitude: 2 },
      { ...input, extra: true },
      { ...input, address: '  ' },
      { ...input, address: 'あ'.repeat(201) },
      { ...input, building: 'あ'.repeat(101) },
      { ...input, deliveryNote: 'あ'.repeat(101) },
      { ...input, building: null },
      { ...input, address: 123 },
      { ...input, address: String.fromCharCode(0) },
    ])
      expect((await request('', 'POST', body, cookie)).status).toBe(400);
    expect((await request('/invalid-id', 'GET', undefined, cookie)).status).toBe(400);
    expect(http).not.toHaveBeenCalled();
    expect(await db.select().from(addresses)).toEqual([]);
  });

  it.each([
    ['不明住所', { status: { code: 200 }, results: [] }, 422],
    [
      '道路だけの結果',
      {
        ...success,
        results: [{ ...success.results[0], components: { _type: 'road', country_code: 'jp' } }],
      },
      422,
    ],
    ['複数候補', { ...success, results: [...success.results, ...success.results] }, 422],
    [
      '範囲外座標',
      { ...success, results: [{ ...success.results[0], geometry: { lat: 91, lng: 139 } }] },
      503,
    ],
    ['不正レスポンス', { results: 'invalid' }, 503],
    ['キー拒否', { status: { code: 403 }, results: [] }, 503],
  ])('%s では新規作成も既存住所の置換も行わない', async (_name, payload, status) => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    http.mockImplementation(() => Promise.resolve(Response.json(payload)));
    expect((await request('', 'POST', input, cookie)).status).toBe(status);
    expect(
      (await request(`/${saved.id}`, 'PATCH', { ...input, address: '変更する住所' }, cookie))
        .status,
    ).toBe(status);
    expect(await db.select().from(addresses)).toMatchObject([saved]);
  });

  it.each(['HTTPエラー', 'JSONエラー', '通信エラー', 'タイムアウト'])(
    '%s で既存値を壊さない',
    async (mode) => {
      const cookie = await cookieFor((await seed()).token);
      const saved = await create(cookie);
      http.mockImplementation((_url, init) => {
        if (mode === 'HTTPエラー') return Promise.resolve(new Response('', { status: 429 }));
        if (mode === 'JSONエラー') return Promise.resolve(new Response('invalid json'));
        if (mode === '通信エラー') return Promise.reject(new Error('network error with secret'));
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          }),
        );
      });
      expect((await request('', 'POST', input, cookie)).status).toBe(503);
      expect(
        (await request(`/${saved.id}`, 'PATCH', { ...input, address: '変更する住所' }, cookie))
          .status,
      ).toBe(503);
      expect(await db.select().from(addresses)).toMatchObject([saved]);
    },
  );

  it('地図キーが未設定なら設定エラーを返し書き込まない', async () => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    const unconfigured = createApp({ auth, db, config, getClientIp: () => undefined });
    for (const [path, method] of [
      ['/addresses', 'POST'],
      [`/addresses/${saved.id}`, 'PATCH'],
    ] as const) {
      const response = await unconfigured.request(`${config.baseURL}${path}`, {
        method,
        headers: { cookie, origin: config.webURL, 'content-type': 'application/json' },
        body: JSON.stringify({ ...input, address: '変更する住所' }),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'GEOCODING_NOT_CONFIGURED' });
    }
    expect(await db.select().from(addresses)).toMatchObject([saved]);
  });

  it('HTTP送信は住所だけを送り建物・メモ・所有者・キーを応答へ露出しない', async () => {
    const owner = await seed();
    await create(await cookieFor(owner.token));
    const [url, init] = http.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new Error('URLを渡してください');
    const sent = url;
    expect(sent.origin + sent.pathname).toBe('https://api.opencagedata.com/geocode/v1/json');
    expect(Object.fromEntries(sent.searchParams)).toEqual({
      key: 'test-key',
      q: input.address,
      countrycode: 'jp',
      language: 'ja',
      limit: '2',
      no_annotations: '1',
      no_record: '1',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.redirect).toBe('error');
  });
});
