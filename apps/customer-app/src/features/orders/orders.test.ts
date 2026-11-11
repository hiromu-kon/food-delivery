import { afterEach, expect, it, vi } from 'vitest';
import type { OrderDetail } from '@repo/contract';
import type { SessionController } from '../auth/session';
import { AuthRequestError } from '../auth/request';
import { OrdersController, type OrdersTransport } from './orders';

const order = { id: 'order-1', status: 'pending' } as OrderDetail;
function setup() {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => Promise.resolve(values.get(key) ?? null),
    setItem: (key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      values.delete(key);
      return Promise.resolve();
    },
  };
  let changed = () => {};
  const session = {
    getSnapshot: () => ({ status: 'authenticated', user: { id: 'user-1' } }),
    subscribe: (callback: () => void) => {
      changed = callback;
      return () => {};
    },
  } as unknown as SessionController;
  const transport: OrdersTransport = {
    detail: vi.fn(() => Promise.resolve({ ...order })),
    list: vi.fn(() => Promise.resolve([])),
    cancel: vi.fn(() => Promise.resolve({ id: order.id, status: 'canceled' as const })),
  };
  const controller = new OrdersController(transport, session, storage);
  controller.connect();
  controller.setRoute(order.id, true);
  return { controller, transport, storage, session, changed: () => changed() };
}
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
afterEach(() => vi.useRealTimers());
it('locks double submits and invalidates an older poll before committing success', async () => {
  const { controller, transport } = setup();
  await flush();
  let complete!: (value: OrderDetail) => void;
  vi.mocked(transport.detail).mockImplementationOnce(
    () =>
      new Promise((r) => {
        complete = r;
      }),
  );
  const poll = controller.reload();
  const first = controller.cancel(order.id);
  await controller.cancel(order.id);
  await first;
  complete(order);
  await poll;
  expect(transport.cancel).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().cancellationMessage).toContain('完了しました');
});
it('keeps a 503 uncertain when GET says canceled, restores it on remount, and retries the same ID', async () => {
  const { controller, transport, storage, session } = setup();
  await flush();
  vi.mocked(transport.cancel).mockRejectedValueOnce(new AuthRequestError('unknown', '', 503));
  vi.mocked(transport.detail).mockResolvedValue({ ...order, status: 'canceled' });
  await controller.cancel(order.id);
  await flush();
  expect(controller.getSnapshot().cancellation).toBe('uncertain');
  const reopened = new OrdersController(transport, session, storage);
  reopened.setRoute(order.id, true);
  await flush();
  expect(reopened.getSnapshot().cancellation).toBe('uncertain');
  await reopened.cancel(order.id);
  await flush();
  expect(transport.cancel).toHaveBeenNthCalledWith(2, order.id);
  expect(reopened.getSnapshot().cancellation).toBeUndefined();
});
it('blocks an acceptance race even if the refresh fails', async () => {
  const { controller, transport } = setup();
  await flush();
  vi.mocked(transport.cancel).mockRejectedValue(new AuthRequestError('受付済み', '', 409));
  vi.mocked(transport.detail).mockRejectedValue(new Error('offline'));
  await controller.cancel(order.id);
  await flush();
  await controller.cancel(order.id);
  expect(transport.cancel).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().cancellation).toBe('blocked');
});
it.each([400, 404])('discards detail on cancellation HTTP %s', async (status) => {
  const { controller, transport } = setup();
  await flush();
  vi.mocked(transport.cancel).mockRejectedValue(new AuthRequestError('not found', '', status));
  vi.mocked(transport.detail).mockRejectedValue(new AuthRequestError('not found', '', status));
  await controller.cancel(order.id);
  await flush();
  expect(controller.getSnapshot().order).toBeUndefined();
});
it('ignores a late cancellation result after an auth change', async () => {
  const { controller, transport, changed } = setup();
  await flush();
  let finish!: (value: { id: string; status: 'canceled' }) => void;
  vi.mocked(transport.cancel).mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const pending = controller.cancel(order.id);
  await flush();
  changed();
  finish({ id: order.id, status: 'canceled' });
  await pending;
  expect(controller.getSnapshot().cancellationMessage).toBeUndefined();
});
it('does not submit for a stale dialog or a nonpending order', async () => {
  const { controller, transport } = setup();
  await flush();
  await controller.cancel('other-order');
  vi.mocked(transport.detail).mockResolvedValue({ ...order, status: 'preparing' });
  await controller.reload();
  await controller.cancel(order.id);
  expect(transport.cancel).not.toHaveBeenCalled();
});
it('does not send if durable recovery cannot be saved', async () => {
  const { controller, transport, storage } = setup();
  await flush();
  storage.setItem = vi.fn(() => Promise.reject(Error('disk full')));
  await controller.cancel(order.id);
  expect(transport.cancel).not.toHaveBeenCalled();
});
it('resumes reads after returning while a cancellation is still in flight', async () => {
  const { controller, transport } = setup();
  await flush();
  let finish!: (value: { id: string; status: 'canceled' }) => void;
  vi.mocked(transport.cancel).mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const pending = controller.cancel(order.id);
  await flush();
  controller.setRoute(order.id, false);
  controller.setRoute(order.id, true);
  vi.mocked(transport.detail).mockResolvedValue({ ...order, status: 'canceled' });
  finish({ id: order.id, status: 'canceled' });
  await pending;
  await flush();
  expect(controller.getSnapshot().order?.status).toBe('canceled');
  expect(controller.getSnapshot().status).toBe('ready');
});
