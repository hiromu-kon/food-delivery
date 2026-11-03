import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionController } from '../features/auth/session';
import { createAddressTransport } from './addresses';

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
async function setup() {
  const clear = vi.fn().mockResolvedValue(undefined);
  const session = new SessionController(
    { read: () => Promise.resolve('signed'), write: () => Promise.resolve(), clear },
    {
      me: () => Promise.resolve({ user }),
      signIn: () => Promise.resolve({ user, token: 'signed' }),
      signOut: () => Promise.resolve(),
    },
  );
  await session.restore();
  return { api: createAddressTransport(session), session, clear };
}
afterEach(() => vi.unstubAllGlobals());
describe('住所HTTP transport', () => {
  it('hcで各methodとBearerを送りCookieを使わず、PATCH本文に変更外の項目を足さない', async () => {
    const { api } = await setup();
    const nativeFetch = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const body = init?.method === 'GET' ? { addresses: [address] } : { address, status: true };
      return Promise.resolve(new Response(JSON.stringify(body)));
    });
    vi.stubGlobal('fetch', nativeFetch);
    expect(await api.list()).toEqual([address]);
    await api.create({ address: address.address, building: '', deliveryNote: '' });
    await api.update(address.id, { deliveryNote: '玄関前' });
    await api.remove(address.id);
    expect(nativeFetch.mock.calls.map((call) => call[1]?.method)).toEqual([
      'GET',
      'POST',
      'PATCH',
      'DELETE',
    ]);
    for (const [, init] of nativeFetch.mock.calls) {
      expect(init?.credentials).toBe('omit');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed');
    }
    expect(nativeFetch.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ deliveryNote: '玄関前' }));
    expect(nativeFetch.mock.calls[2]?.[0]).toBe(`http://api.example.test/addresses/${address.id}`);
  });
  it.each([401, 403])('%sの住所応答はセッション失効へ反映する', async (status) => {
    const { api, session, clear } = await setup();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status })));
    await expect(api.list()).rejects.toMatchObject({ status });
    expect(clear).toHaveBeenCalledOnce();
    expect(session.getSnapshot().status).toBe('anonymous');
  });
  it.each([422, 503])('%sを再試行可能な日本語エラーにする', async (status) => {
    const { api, session } = await setup();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status })));
    await expect(
      api.create({ address: address.address, building: '', deliveryNote: '' }),
    ).rejects.toThrow('再試行');
    expect(session.getSnapshot().status).toBe('authenticated');
  });
});
