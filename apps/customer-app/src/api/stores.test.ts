import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionController } from '../features/auth/session';
import { StoreSearchController } from '../features/stores/store-search';
import { createStoreSearchTransport } from './stores';

const user = {
  id: 'customer',
  name: '注文者',
  email: 'customer@example.test',
  emailVerified: true,
  phoneNumber: '09012345678',
  role: 'customer' as const,
};
const address = {
  id: 'c07517c1-f24d-4f07-8dc9-33c812980da2',
  address: '東京都千代田区1-1',
  building: '',
  label: '',
  isDefault: false,
  deliveryNote: '',
  latitude: 35,
  longitude: 139,
};
const store = {
  id: '2a37cd59-1ba3-4c0a-9a61-7107c7fe1730',
  name: 'テスト店',
  description: '',
  address: '東京都',
  latitude: 35,
  longitude: 139,
  deliveryRadiusMeters: 3000,
  minimumOrderAmount: 500,
  isAcceptingOrders: false,
  canOrder: false,
  photoUrl: null,
  distanceMeters: 20,
};
async function setup() {
  const clear = vi.fn(async () => {});
  const session = new SessionController(
    { read: () => Promise.resolve('signed'), write: async () => {}, clear },
    {
      me: () => Promise.resolve({ user }),
      signIn: () => Promise.resolve({ user, token: 'signed' }),
      signOut: async () => {},
    },
  );
  await session.restore();
  return { api: createStoreSearchTransport(session), session, clear };
}
afterEach(() => vi.unstubAllGlobals());
describe('店舗検索 HTTP transport', () => {
  it('hcの住所・店舗GETとaddressId、Bearer、no-store/Cookie不使用を検証しcontractで応答を読む', async () => {
    const { api, session } = await setup();
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockImplementation((url) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              (url instanceof Request ? url.url : url.toString()).includes('/stores?')
                ? { stores: [store] }
                : { addresses: [address] },
            ),
          ),
        ),
      );
    vi.stubGlobal('fetch', nativeFetch);
    expect(await api.addresses()).toEqual([address]);
    expect(await api.stores(address.id)).toEqual([store]);
    expect(
      nativeFetch.mock.calls.map(([url]) => (url instanceof Request ? url.url : url.toString())),
    ).toEqual([
      'http://api.example.test/addresses',
      `http://api.example.test/stores?addressId=${address.id}`,
    ]);
    for (const [, init] of nativeFetch.mock.calls) {
      expect(init?.method).toBe('GET');
      expect(init?.cache).toBe('no-store');
      expect(init?.credentials).toBe('omit');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed');
    }
    expect(JSON.stringify(session.getSnapshot())).not.toContain('signed');
  });
  it.each([401, 403])('%sで既存セッションを失効させ住所と店舗を直ちに消す', async (status) => {
    const { api, session, clear } = await setup();
    let failure = false;
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementation((url) =>
          Promise.resolve(
            new Response(
              JSON.stringify(
                (url instanceof Request ? url.url : url.toString()).includes('/stores?')
                  ? failure
                    ? {}
                    : { stores: [store] }
                  : { addresses: [address] },
              ),
              { status: failure ? status : 200 },
            ),
          ),
        ),
    );
    const controller = new StoreSearchController(api, session);
    const disconnect = controller.connect();
    controller.setFocused(true);
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
    failure = true;
    await controller.select(address.id);
    expect(clear).toHaveBeenCalledOnce();
    expect(session.getSnapshot().status).toBe('anonymous');
    expect(controller.getSnapshot()).toMatchObject({
      addresses: [],
      stores: [],
      selectedId: undefined,
    });
    disconnect();
  });
  it('404/500/不正応答は失効せず再試行でき、通信失敗も上位へ返す', async () => {
    const { api, session } = await setup();
    const nativeFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', nativeFetch);
    for (const status of [404, 500]) {
      nativeFetch.mockResolvedValueOnce(new Response('{}', { status }));
      await expect(api.stores(address.id)).rejects.toMatchObject({ status });
    }
    nativeFetch.mockResolvedValueOnce(new Response('{"stores":[{}]}'));
    await expect(api.stores(address.id)).rejects.toThrow();
    nativeFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(api.stores(address.id)).rejects.toThrow('offline');
    expect(session.getSnapshot().status).toBe('authenticated');
  });
});
