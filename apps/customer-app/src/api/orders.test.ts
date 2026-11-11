import { afterEach, expect, it, vi } from 'vitest';
import type { SessionController } from '@/features/auth/session';
import { createOrderTransport } from './orders';
const session = {
  authenticatedRequest: <T>(request: (token: string) => Promise<T>) => request('signed-session'),
} as SessionController;
const request = {
  storeId: 'store',
  addressId: 'address',
  items: [{ menuItemId: 'menu', quantity: 2 }],
  fulfillment: 'hand_delivery' as const,
  paymentMethodId: 'pm_native',
};
afterEach(() => vi.unstubAllGlobals());
it('POSTs the authenticated request and UUID key with no price/card data', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify({ order: { id: 'order', total: 9999 } }), { status: 201 }),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  await expect(createOrderTransport(session)(request, 'uuid-key')).resolves.toEqual({
    id: 'order',
  });
  expect(fetch).toHaveBeenCalledWith(
    'http://api.example.test/orders',
    expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify(request),
    }),
  );
  const init = fetch.mock.calls[0]?.[1];
  const headers = new Headers(init?.headers);
  expect(headers.get('Authorization')).toBe('Bearer signed-session');
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(headers.get('Idempotency-Key')).toBe('uuid-key');
});
it.each([401, 402, 409, 422, 500, 503])(
  'exposes HTTP %s as a typed checkout failure',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status }))),
    );
    await expect(createOrderTransport(session)(request, 'uuid-key')).rejects.toMatchObject({
      status,
    });
  },
);

it('cancels with Bearer authentication, no body or idempotency key, and parses the success contract', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(new Response(JSON.stringify({ order: { id, status: 'canceled' } }))),
  );
  vi.stubGlobal('fetch', fetch);
  const { createOrdersTransport } = await import('./orders');
  await expect(createOrdersTransport(session).cancel(id)).resolves.toEqual({
    id,
    status: 'canceled',
  });
  expect(fetch).toHaveBeenCalledWith(
    `http://api.example.test/orders/${id}/cancel`,
    expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
    }),
  );
  const init = fetch.mock.calls[0]?.[1];
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed-session');
  expect(new Headers(init?.headers).has('Idempotency-Key')).toBe(false);
  expect(init?.body).toBeUndefined();
});
it.each([401, 403, 404, 409, 503])(
  'preserves cancellation HTTP %s for session and controller handling',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status }))),
    );
    const { createOrdersTransport } = await import('./orders');
    await expect(
      createOrdersTransport(session).cancel('00000000-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({ status });
  },
);
