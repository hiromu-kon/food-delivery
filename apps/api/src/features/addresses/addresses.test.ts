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
  return Promise.resolve(
    app.request(`${config.baseURL}/addresses${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: config.webURL,
        ...(cookie ? { cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
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

  it('labelはtrimしたUTF-16の20単位まで、isDefaultはbooleanだけを許可する', async () => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    expect(saved).toMatchObject({ label: '', isDefault: false });
    http.mockClear();
    for (const label of ['  職場  ', 'あ'.repeat(20), '😀'.repeat(10), '   ']) {
      const response = await request(`/${saved.id}`, 'PATCH', { label }, cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ address: { label: label.trim() } });
    }
    for (const invalid of [
      { label: 'あ'.repeat(21) },
      { label: `${'😀'.repeat(10)}a` },
      { label: String.fromCharCode(0) },
      { label: null },
      { label: 1 },
      { isDefault: null },
      { isDefault: 'true' },
      { isDefault: 1 },
    ]) {
      expect((await request('', 'POST', { ...input, ...invalid }, cookie)).status).toBe(400);
      expect((await request(`/${saved.id}`, 'PATCH', invalid, cookie)).status).toBe(400);
    }
    expect(http).not.toHaveBeenCalled();
    const response = await request(
      '',
      'POST',
      { ...input, label: ' 自宅 ', isDefault: true },
      cookie,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ address: { label: '自宅', isDefault: true } });
  });

  it('既定切替は本人内だけで原子的に行い、解除・削除後も既定なしを許可する', async () => {
    const owner = await seed();
    const cookie = await cookieFor(owner.token);
    const first = await create(cookie);
    const second = await create(cookie);
    const otherCookie = await cookieFor((await seed()).token);
    const other = await create(otherCookie);
    expect((await request(`/${other.id}`, 'PATCH', { isDefault: true }, otherCookie)).status).toBe(
      200,
    );
    http.mockClear();
    for (const target of [first, second]) {
      expect((await request(`/${target.id}`, 'PATCH', { isDefault: true }, cookie)).status).toBe(
        200,
      );
      expect(
        (await db.select().from(addresses).where(eq(addresses.userId, owner.id)))
          .filter((row) => row.isDefault)
          .map((row) => row.id),
      ).toEqual([target.id]);
    }
    expect((await request(`/${second.id}`, 'PATCH', { label: '職場' }, cookie)).status).toBe(200);
    expect((await request(`/${other.id}`, 'PATCH', { isDefault: true }, cookie)).status).toBe(404);
    expect((await request(`/${randomUUID()}`, 'PATCH', { isDefault: true }, cookie)).status).toBe(
      404,
    );
    expect(
      (await request(`/${second.id}`, 'GET', undefined, cookie)).headers.get('cache-control'),
    ).toBe('no-store');
    expect((await request(`/${second.id}`, 'PATCH', { isDefault: false }, cookie)).status).toBe(
      200,
    );
    expect(
      (await db.select().from(addresses).where(eq(addresses.userId, owner.id))).every(
        (row) => !row.isDefault,
      ),
    ).toBe(true);
    await request(`/${first.id}`, 'PATCH', { isDefault: true }, cookie);
    expect((await request(`/${first.id}`, 'DELETE', undefined, cookie)).status).toBe(200);
    expect(
      (await db.select().from(addresses).where(eq(addresses.userId, owner.id))).every(
        (row) => !row.isDefault,
      ),
    ).toBe(true);
    expect(
      (await db.select().from(addresses).where(eq(addresses.id, other.id)))[0]?.isDefault,
    ).toBe(true);
    expect(http).not.toHaveBeenCalled();
  });

  it('同時の既定作成・切替・削除で500や二重既定を発生させず他人を保持する', async () => {
    const owner = await seed();
    const cookie = await cookieFor(owner.token);
    const otherCookie = await cookieFor((await seed()).token);
    const other = await create(otherCookie);
    await request(`/${other.id}`, 'PATCH', { isDefault: true }, otherCookie);
    const created = await Promise.all(
      [1, 2].map(() => request('', 'POST', { ...input, isDefault: true }, cookie)),
    );
    expect(created.map((response) => response.status)).toEqual([201, 201]);
    const rows = await db.select().from(addresses).where(eq(addresses.userId, owner.id));
    expect(rows.filter((row) => row.isDefault)).toHaveLength(1);
    const ids = rows.map((row) => row.id);
    for (let round = 0; round < 5; round++) {
      const responses = await Promise.all(
        ids.map((id) => request(`/${id}`, 'PATCH', { isDefault: true }, cookie)),
      );
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(
        (await db.select().from(addresses).where(eq(addresses.userId, owner.id))).filter(
          (row) => row.isDefault,
        ),
      ).toHaveLength(1);
    }
    const target = ids[0]!;
    const raced = await Promise.all([
      request(`/${target}`, 'DELETE', undefined, cookie),
      request(`/${target}`, 'PATCH', { isDefault: true }, cookie),
      request(`/${other.id}`, 'PATCH', { isDefault: true }, cookie),
    ]);
    expect(raced[0]?.status).toBe(200);
    expect([200, 404]).toContain(raced[1]?.status);
    expect(raced[2]?.status).toBe(404);
    expect(
      (await db.select().from(addresses).where(eq(addresses.userId, owner.id))).filter(
        (row) => row.isDefault,
      ).length,
    ).toBeLessThanOrEqual(1);
    expect(
      (await db.select().from(addresses).where(eq(addresses.id, other.id)))[0]?.isDefault,
    ).toBe(true);
  });

  it('測位失敗では別住所の既定を解除せず、測位中の削除後も既定を変更しない', async () => {
    const cookie = await cookieFor((await seed()).token);
    const first = await create(cookie);
    const second = await create(cookie);
    await request(`/${first.id}`, 'PATCH', { isDefault: true }, cookie);
    http.mockResolvedValueOnce(Response.json({ status: { code: 200 }, results: [] }));
    expect(
      (await request(`/${second.id}`, 'PATCH', { address: '不明住所', isDefault: true }, cookie))
        .status,
    ).toBe(422);
    http.mockResolvedValueOnce(Response.json({ status: { code: 200 }, results: [] }));
    expect((await request('', 'POST', { ...input, isDefault: true }, cookie)).status).toBe(422);
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (response: Response) => void;
    http.mockImplementationOnce(() => {
      started();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const pending = request(
      `/${second.id}`,
      'PATCH',
      { address: '新しい住所', isDefault: true },
      cookie,
    );
    await entered;
    expect((await request(`/${second.id}`, 'DELETE', undefined, cookie)).status).toBe(200);
    finish(Response.json(success));
    expect((await pending).status).toBe(404);
    expect(
      (await db.select().from(addresses)).map((row) => ({ id: row.id, isDefault: row.isDefault })),
    ).toEqual([{ id: first.id, isDefault: true }]);
  });

  it('測位中の差分PATCHを保持し、競合する住所更新も住所と座標を一組で保存する', async () => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (response: Response) => void;
    http.mockImplementationOnce(() => {
      started();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const slow = request(`/${saved.id}`, 'PATCH', { address: '遅い住所', isDefault: true }, cookie);
    await entered;
    expect(
      (
        await request(
          `/${saved.id}`,
          'PATCH',
          { label: '職場', deliveryNote: '保持するメモ' },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect((await request(`/${saved.id}`, 'PATCH', { address: '速い住所' }, cookie)).status).toBe(
      200,
    );
    finish(
      Response.json({
        ...success,
        results: [{ ...success.results[0], geometry: { lat: 34, lng: 135 } }],
      }),
    );
    expect((await slow).status).toBe(200);
    expect((await db.select().from(addresses))[0]).toMatchObject({
      address: '遅い住所',
      latitude: 34,
      longitude: 135,
      label: '職場',
      deliveryNote: '保持するメモ',
      isDefault: true,
    });
  });

  it('DBのpartial unique indexが直接書き込みでも同一ユーザーの二重既定を拒否する', async () => {
    const owner = await seed();
    const values = { ...input, userId: owner.id, latitude: 35, longitude: 139, isDefault: true };
    await db.insert(addresses).values(values);
    await expect(db.insert(addresses).values(values)).rejects.toThrow();
    await db.insert(addresses).values({ ...values, isDefault: false });
    await db.insert(addresses).values({ ...values, userId: (await seed()).id });
  });

  it('R-15 PATCHは住所を省略すると地図APIを呼ばず指定項目だけを変更する', async () => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    http.mockClear();
    expect(
      (await request(`/${saved.id}`, 'PATCH', { deliveryNote: '玄関前で呼んでください' }, cookie))
        .status,
    ).toBe(200);
    expect((await request(`/${saved.id}`, 'PATCH', { building: '' }, cookie)).status).toBe(200);
    expect((await request(`/${saved.id}`, 'PATCH', {}, cookie)).status).toBe(400);
    expect((await request(`/${saved.id}`, 'PATCH', { userId: 'other' }, cookie)).status).toBe(400);
    expect(http).not.toHaveBeenCalled();
    expect((await db.select().from(addresses))[0]).toMatchObject({
      ...saved,
      building: '',
      deliveryNote: '玄関前で呼んでください',
    });
  });

  it('明示された住所は保存済み住所と同じでも再測位した座標と一緒に更新する', async () => {
    const cookie = await cookieFor((await seed()).token);
    const saved = await create(cookie);
    http.mockClear();
    http.mockResolvedValueOnce(
      Response.json({
        ...success,
        results: [{ ...success.results[0], geometry: { lat: 35.68, lng: 139.76 } }],
      }),
    );
    const response = await request(`/${saved.id}`, 'PATCH', { address: saved.address }, cookie);
    expect(response.status).toBe(200);
    expect(http).toHaveBeenCalledTimes(1);
    const expected = { ...saved, latitude: 35.68, longitude: 139.76 };
    expect(await response.json()).toEqual({ address: expected });
    expect((await db.select().from(addresses))[0]).toMatchObject(expected);
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
    expect(
      (
        await request(
          '',
          'POST',
          { ...input, label: '職場', isDefault: true },
          await cookieFor(owner.token),
        )
      ).status,
    ).toBe(201);
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
