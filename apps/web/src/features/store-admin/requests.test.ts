import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.example.test' } }));
import { deleteStore, getStore, issueStaff, listStores, saveStore } from './requests';

const id = '00000000-0000-4000-8000-000000000001';
const store = {
  id,
  name: '架空店舗',
  description: '',
  address: '架空住所',
  latitude: 35,
  longitude: 139,
  deliveryRadiusMeters: 3000,
  minimumOrderAmount: 1000,
  isAcceptingOrders: false,
  photoUrl: null,
};
const input = {
  name: store.name,
  description: '',
  address: store.address,
  deliveryRadiusMeters: 3000,
  minimumOrderAmount: 1000,
  isAcceptingOrders: false,
  photoUrl: null,
};
const staffInput = {
  name: '架空スタッフ',
  email: 'staff@example.test',
  phoneNumber: '09000000000',
  password: 'fictional-password-123',
};
afterEach(() => vi.unstubAllGlobals());
describe('運営店舗のAPI通信', () => {
  it('CRUDと発行を実際のRPCルートへCookie付きで送り、204をJSON解析しない', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ stores: [store] }))
      .mockResolvedValueOnce(Response.json({ store }))
      .mockResolvedValueOnce(Response.json({ store }))
      .mockResolvedValueOnce(Response.json({ store }))
      .mockResolvedValueOnce(
        Response.json({
          staff: {
            id: 'staff',
            name: staffInput.name,
            email: staffInput.email,
            phoneNumber: staffInput.phoneNumber,
            role: 'store',
            emailVerified: false,
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await listStores(signal)).toEqual([store]);
    await getStore(id, signal);
    await saveStore(input, signal);
    await saveStore(input, signal, id);
    await issueStaff(id, staffInput, signal);
    await deleteStore(id, signal);
    expect(
      fetch.mock.calls.map(([url, init]) => [
        typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
        init?.method ?? 'GET',
      ]),
    ).toEqual([
      ['http://api.example.test/admin/stores', 'GET'],
      [`http://api.example.test/admin/stores/${id}`, 'GET'],
      ['http://api.example.test/admin/stores', 'POST'],
      [`http://api.example.test/admin/stores/${id}`, 'PATCH'],
      [`http://api.example.test/admin/stores/${id}/staff`, 'POST'],
      [`http://api.example.test/admin/stores/${id}`, 'DELETE'],
    ]);
    for (const [, init] of fetch.mock.calls)
      expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' });
  });
  it('権限失効をログインへ戻し、競合・地図障害を成功扱いしない', async () => {
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { replace } });
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    for (const status of [401, 403]) {
      fetch.mockResolvedValueOnce(new Response(null, { status }));
      await expect(listStores(signal)).rejects.toThrow('運営権限');
    }
    expect(replace.mock.calls).toEqual([['/admin/login'], ['/admin/login?reason=denied']]);
    for (const status of [409, 503]) {
      fetch.mockResolvedValueOnce(
        Response.json({ code: 'TEST_ERROR', message: '再試行してください' }, { status }),
      );
      await expect(saveStore(input, signal, id)).rejects.toThrow('再試行');
    }
  });
  it('離脱後の応答と不正な応答を表示に使わず、不正入力を送信しない', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ stores: [] }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(listStores(controller.signal)).rejects.toThrow();
    fetch.mockResolvedValueOnce(Response.json({ store: { id } }));
    await expect(getStore(id, new AbortController().signal)).rejects.toThrow();
    const calls = fetch.mock.calls.length;
    await expect(
      saveStore({ ...input, minimumOrderAmount: -1 }, new AbortController().signal),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
