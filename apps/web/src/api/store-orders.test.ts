import { z } from 'zod';
import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(),
  ready: vi.fn(),
}));
vi.mock('./client', () => ({
  apiClient: {
    store: {
      orders: {
        $get: mocks.list,
        ':id': {
          $get: mocks.detail,
          accept: { $post: mocks.accept },
          reject: { $post: mocks.reject },
          ready: { $post: mocks.ready },
        },
      },
    },
  },
}));
import { actOnStoreOrder, getStoreOrder, getStoreOrders } from './store-orders';
const id = '00000000-0000-4000-8000-000000000001';
const order = {
  id,
  storeId: id,
  status: 'pending',
  total: 1700,
  createdAt: '2026-01-01T00:00:00Z',
  acceptanceDeadline: '2026-01-01T00:10:00Z',
  paymentReconciling: false,
  items: [],
  subtotal: 1400,
  deliveryFee: 300,
  deliveryNote: '',
  courier: null,
};
beforeEach(() => vi.resetAllMocks());
describe('store order transport', () => {
  it('uses scoped RPC routes and validates responses for each action', async () => {
    for (const action of ['accept', 'reject', 'ready'] as const) {
      mocks[action].mockResolvedValue(Response.json({ order }));
      const controller = new AbortController();
      expect(await actOnStoreOrder(id, action, controller.signal)).toEqual(order);
      expect(mocks[action].mock.calls[0]?.[0]).toEqual({ param: { id } });
      const options = z
        .object({ init: z.object({ signal: z.instanceof(AbortSignal) }) })
        .parse(mocks[action].mock.calls[0]?.[1]);
      expect(options.init.signal.aborted).toBe(false);
    }
  });
  it('does not report ambiguous responses, invalid payloads or another order as success', async () => {
    for (const response of [
      new Response('{}', { status: 503 }),
      Response.json({}),
      Response.json({ order: { ...order, id: '00000000-0000-4000-8000-000000000002' } }),
    ]) {
      mocks.accept.mockResolvedValueOnce(response);
      await expect(actOnStoreOrder(id, 'accept', new AbortController().signal)).rejects.toThrow();
    }
  });
  it('reports conflicts and missing orders with recovery instructions', async () => {
    mocks.ready.mockResolvedValue(new Response('{}', { status: 409 }));
    await expect(actOnStoreOrder(id, 'ready', new AbortController().signal)).rejects.toThrow(
      '最新の状態',
    );
    mocks.detail.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(getStoreOrder(id, new AbortController().signal)).rejects.toMatchObject({
      stop: true,
    });
  });
  it('validates polling responses and forwards lifecycle cancellation', async () => {
    mocks.list
      .mockResolvedValueOnce(Response.json({ orders: [order] }))
      .mockResolvedValueOnce(Response.json({ orders: [{ ...order, status: 'invalid' }] }));
    const controller = new AbortController();
    expect(await getStoreOrders(controller.signal)).toHaveLength(1);
    const call: unknown = mocks.list.mock.calls[0]?.[1];
    const options = z.object({ init: z.object({ signal: z.instanceof(AbortSignal) }) }).parse(call);
    controller.abort();
    const signal = options.init.signal;
    expect(signal.aborted).toBe(true);
    await expect(getStoreOrders(new AbortController().signal)).rejects.toThrow();
  });
});
