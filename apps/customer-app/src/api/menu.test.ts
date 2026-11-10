import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionController } from '../features/auth/session';
import { MenuController } from '../features/menu/menu';
import { createMenuTransport } from './menu';

const user = {
  id: 'customer',
  name: '注文者',
  email: 'a@example.test',
  emailVerified: true,
  phoneNumber: '09012345678',
  role: 'customer' as const,
};
const id = '2a37cd59-1ba3-4c0a-9a61-7107c7fe1730';
const item = (id: string, soldout = false) => ({
  id,
  name: id,
  description: '説明',
  price: 980,
  photoUrl: null,
  soldout,
  sortOrder: 0,
});
const payload = {
  store: {
    id,
    name: '合成店',
    description: '',
    address: '合成住所',
    latitude: 35,
    longitude: 139,
    deliveryRadiusMeters: 3000,
    minimumOrderAmount: 500,
    isAcceptingOrders: false,
    photoUrl: null,
  },
  categories: [
    {
      id,
      name: '定食',
      description: '',
      photoUrl: null,
      sortOrder: 0,
      items: [item(id, true), item('c07517c1-f24d-4f07-8dc9-33c812980da2')],
    },
    {
      id: 'c07517c1-f24d-4f07-8dc9-33c812980da2',
      name: '空',
      description: '',
      photoUrl: null,
      sortOrder: 0,
      items: [],
    },
  ],
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
  return { api: createMenuTransport(session), session, clear };
}
afterEach(() => vi.unstubAllGlobals());
describe('メニュー HTTP transport', () => {
  it('typed GETに店舗IDだけを渡し、Bearer/no-store/Cookie不使用、contractと順序を保持する', async () => {
    const { api } = await setup();
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', nativeFetch);
    expect(await api.menu(id)).toEqual(payload);
    const call = nativeFetch.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('missing GET');
    const [url, init] = call;
    expect(url instanceof Request ? url.url : url.toString()).toBe(
      `http://api.example.test/stores/${id}/menu`,
    );
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'omit' });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed');
  });
  it.each([401, 403])('%sでメニューとセッションを破棄する', async (status) => {
    const { api, session, clear } = await setup();
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(payload))));
    vi.stubGlobal('fetch', nativeFetch);
    const controller = new MenuController(api, session);
    const disconnect = controller.connect();
    controller.setRoute(id, true);
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
    nativeFetch.mockResolvedValueOnce(new Response('{}', { status }));
    await controller.reload();
    expect(clear).toHaveBeenCalledOnce();
    expect(session.getSnapshot().status).toBe('anonymous');
    expect(controller.getSnapshot().menu).toBeUndefined();
    disconnect();
  });
  it('404/500/不正応答/通信失敗から空メニューへ再試行できる', async () => {
    const { api, session } = await setup();
    const nativeFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', nativeFetch);
    for (const status of [404, 500]) {
      nativeFetch.mockResolvedValueOnce(new Response('{}', { status }));
      await expect(api.menu(id)).rejects.toMatchObject({ status });
    }
    nativeFetch.mockResolvedValueOnce(new Response('{"categories":[]}'));
    await expect(api.menu(id)).rejects.toThrow();
    nativeFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(api.menu(id)).rejects.toThrow('offline');
    nativeFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...payload, categories: [] })));
    expect((await api.menu(id)).categories).toEqual([]);
    expect(session.getSnapshot().status).toBe('authenticated');
  });
});
