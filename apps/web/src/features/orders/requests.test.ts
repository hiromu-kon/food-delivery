import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.example.test' } }));
import { cancelOrder, OrderAccessError, OrderConflictError, OrderNotFoundError } from './requests';
const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => vi.unstubAllGlobals());
it('R-07 posts the order ID without a body and validates confirmed cancellation', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ order: { id, status: 'canceled' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(cancelOrder(id)).resolves.toBeUndefined();
  expect(String(fetch.mock.calls[0]?.[0])).toBe(`http://api.example.test/orders/${id}/cancel`);
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
});
it('R-07 rejects uncertain payment results, malformed responses and a different order', async () => {
  for (const response of [
    new Response(null, { status: 503 }),
    Response.json({}),
    Response.json({ order: { id: '22222222-2222-4222-8222-222222222222', status: 'canceled' } }),
    Response.json({ order: { id, status: 'pending' } }),
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(cancelOrder(id)).rejects.toThrow();
  }
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  await expect(cancelOrder(id)).rejects.toThrow();
});
it('R-07 distinguishes acceptance conflicts, unavailable orders and expired access', async () => {
  const replace = vi.fn();
  vi.stubGlobal('window', { location: { replace } });
  for (const [status, error] of [
    [409, OrderConflictError],
    [404, OrderNotFoundError],
    [400, OrderNotFoundError],
    [401, OrderAccessError],
    [403, OrderAccessError],
  ] as const) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(cancelOrder(id)).rejects.toBeInstanceOf(error);
  }
  expect(replace.mock.calls).toEqual([['/login'], ['/access-denied']]);
});
