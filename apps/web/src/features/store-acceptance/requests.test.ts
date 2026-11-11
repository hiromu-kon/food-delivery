import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.example.test' } }));
import { loadAcceptance, saveAcceptance } from './requests';

const id = '11111111-1111-4111-8111-111111111111';
const context = {
  user: {
    id: 'staff',
    name: 'Staff',
    email: 'staff@example.test',
    emailVerified: true,
    phoneNumber: '',
    role: 'store',
  },
  store: { id, name: 'Store' },
};
afterEach(() => vi.unstubAllGlobals());

it('uses authenticated membership and reads the persisted paused state', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(context))
    .mockResolvedValueOnce(
      Response.json({
        store: {
          ...context.store,
          description: '',
          address: '',
          latitude: 35,
          longitude: 139,
          deliveryRadiusMeters: 1000,
          minimumOrderAmount: 0,
          isAcceptingOrders: false,
          photoUrl: null,
        },
        categories: [],
      }),
    );
  vi.stubGlobal('fetch', fetch);
  await expect(loadAcceptance()).resolves.toEqual({ ...context.store, isAcceptingOrders: false });
  expect(String(fetch.mock.calls[1]?.[0])).toBe(`http://api.example.test/stores/${id}/menu`);
});
it('does not write after membership changes or access is revoked', async () => {
  for (const response of [
    Response.json({
      ...context,
      store: { id: '22222222-2222-4222-8222-222222222222', name: 'Other' },
    }),
    new Response(null, { status: 403 }),
    new Response(null, { status: 401 }),
  ]) {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    await expect(saveAcceptance(id, false)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});
it('sends an explicit desired boolean without a store ID and displays the returned state', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(context))
    .mockResolvedValueOnce(Response.json({ store: { id, isAcceptingOrders: false } }));
  vi.stubGlobal('fetch', fetch);
  await expect(saveAcceptance(id, false)).resolves.toEqual({ id, isAcceptingOrders: false });
  expect(fetch.mock.calls[1]?.[1]).toMatchObject({
    method: 'PATCH',
    body: JSON.stringify({ isAcceptingOrders: false }),
    credentials: 'include',
    cache: 'no-store',
  });
});
it('rejects uncertain writes and malformed or mismatched success responses', async () => {
  for (const response of [
    new Response(null, { status: 500 }),
    Response.json({}),
    Response.json({
      store: { id: '22222222-2222-4222-8222-222222222222', isAcceptingOrders: true },
    }),
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(Response.json(context)).mockResolvedValueOnce(response),
    );
    await expect(saveAcceptance(id, true)).rejects.toThrow();
  }
});
