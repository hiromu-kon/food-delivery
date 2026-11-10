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
  const fetch = vi.fn(() =>
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
      headers: {
        Authorization: 'Bearer signed-session',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'uuid-key',
      },
      body: JSON.stringify(request),
    }),
  );
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
