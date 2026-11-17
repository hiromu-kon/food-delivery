import { afterEach, expect, it, vi } from 'vitest';

import { sessionTransport } from './auth';
import {
  getCourier,
  setAvailability,
  listDeliveries,
  currentDelivery,
  deliveryDetail,
  acceptDelivery,
  receiveDelivery,
  completeDelivery,
  deliveryHistory,
} from './courier';
import { SessionController } from '../features/auth/session';

const user = {
  id: 'courier-a',
  name: '架空配達員',
  email: 'courier@example.test',
  emailVerified: true,
  phoneNumber: '09000000000',
  role: 'courier',
};
const profile = { user, courier: { isAvailable: false } };
afterEach(() => vi.unstubAllGlobals());
it('ログイン後に配達員登録を確認し、更新された署名Bearerだけを保存する', async () => {
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ user }), { headers: { 'set-auth-token': 'signed' } }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(profile), { headers: { 'set-auth-token': 'renewed' } }),
    );
  vi.stubGlobal('fetch', nativeFetch);
  expect(
    await sessionTransport.signIn({ email: user.email, password: 'fictional-password' }),
  ).toEqual({ user, token: 'renewed' });
  expect(nativeFetch.mock.calls[1]?.[0]).toBe('http://api.example.test/courier/me');
  expect(new Headers(nativeFetch.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(
    'Bearer signed',
  );
  expect(nativeFetch.mock.calls[0]?.[1]?.credentials).toBe('omit');
});
it('配達員登録を確認できないログインでは発行されたセッションを失効させる', async () => {
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ user }), { headers: { 'set-auth-token': 'signed' } }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 }))
    .mockResolvedValueOnce(new Response('{"status":true}'));
  vi.stubGlobal('fetch', nativeFetch);
  await expect(
    sessionTransport.signIn({ email: user.email, password: 'fictional-password' }),
  ).rejects.toMatchObject({ status: 403 });
  expect(nativeFetch.mock.calls[2]?.[0]).toBe('http://api.example.test/auth/sign-out');
});
it('本人の取得と稼働値の指定を型付きクライアントで送り、失効時は端末保存を破棄する', async () => {
  const clear = vi.fn().mockResolvedValue(undefined);
  const controller = new SessionController(
    { read: () => Promise.resolve('signed'), write: async () => {}, clear },
    sessionTransport,
  );
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(profile)));
  vi.stubGlobal('fetch', nativeFetch);
  await controller.restore();
  nativeFetch.mockResolvedValueOnce(new Response(JSON.stringify(profile)));
  expect(await getCourier(controller)).toEqual(profile);
  nativeFetch.mockResolvedValueOnce(new Response('{"isAvailable":true}'));
  expect(await setAvailability(controller, true)).toEqual({ isAvailable: true });
  const init = nativeFetch.mock.calls.at(-1)?.[1];
  expect(init?.method).toBe('PATCH');
  expect(init?.body).toBe(JSON.stringify({ isAvailable: true }));
  nativeFetch.mockResolvedValueOnce(new Response('{"code":"ACCOUNT_DISABLED"}', { status: 403 }));
  await expect(setAvailability(controller, false)).rejects.toMatchObject({ status: 403 });
  expect(clear).toHaveBeenCalledOnce();
  expect(controller.getSnapshot().status).toBe('anonymous');
});

const delivery = {
  id: '00000000-0000-4000-8000-000000000063',
  status: 'ready',
  storeName: '架空店舗',
  distanceMeters: 111,
  storeAddress: '店舗住所',
  address: 'お届け先',
  building: '101',
  items: [
    {
      menuItemId: '00000000-0000-4000-8000-000000000064',
      name: 'カレー',
      unitPrice: 700,
      quantity: 1,
    },
  ],
  fulfillment: 'hand_delivery',
  dropoffLocation: null,
  isAssignedToMe: false,
};
async function deliveryController() {
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(profile)));
  vi.stubGlobal('fetch', nativeFetch);
  const controller = new SessionController(
    { read: () => Promise.resolve('signed'), write: async () => {}, clear: async () => {} },
    sessionTransport,
  );
  await controller.restore();
  return { controller, nativeFetch };
}
it('一覧・詳細・担当中の取得と受注を署名Bearerで送り、レスポンスを検証する', async () => {
  const { controller, nativeFetch } = await deliveryController();
  nativeFetch.mockResolvedValueOnce(new Response(JSON.stringify({ orders: [delivery] })));
  expect((await listDeliveries(controller)).orders[0]?.id).toBe(delivery.id);
  nativeFetch.mockResolvedValueOnce(new Response(JSON.stringify({ order: delivery })));
  expect((await deliveryDetail(controller, delivery.id)).order.isAssignedToMe).toBe(false);
  nativeFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ order: { ...delivery, isAssignedToMe: true, deliveryNote: '入口' } }),
    ),
  );
  expect((await acceptDelivery(controller, delivery.id)).order.deliveryNote).toBe('入口');
  const [path, init] = nativeFetch.mock.calls.at(-1)!;
  expect(path).toBe(`http://api.example.test/courier/orders/${delivery.id}/accept`);
  expect(init?.method).toBe('POST');
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer signed');
  nativeFetch.mockResolvedValueOnce(new Response('{"order":null}'));
  expect(await currentDelivery(controller)).toEqual({ order: null });
  nativeFetch.mockResolvedValueOnce(new Response('{"orders":[{"id":"invalid"}]}'));
  await expect(listDeliveries(controller)).rejects.toThrow();
});
it('受注競合のコードを保持し、結果不明後も担当中の再取得で確認できる', async () => {
  const { controller, nativeFetch } = await deliveryController();
  nativeFetch.mockResolvedValueOnce(
    new Response('{"code":"ORDER_ALREADY_ASSIGNED"}', { status: 409 }),
  );
  await expect(acceptDelivery(controller, delivery.id)).rejects.toMatchObject({
    code: 'ORDER_ALREADY_ASSIGNED',
    status: 409,
  });
  expect(controller.getSnapshot().status).toBe('authenticated');
  nativeFetch.mockRejectedValueOnce(new TypeError('connection lost'));
  await expect(acceptDelivery(controller, delivery.id)).rejects.toThrow('connection lost');
  nativeFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ order: { ...delivery, isAssignedToMe: true } })),
  );
  expect((await currentDelivery(controller)).order?.isAssignedToMe).toBe(true);
});
it('受け取り・配達完了・自分の配達履歴を型付き API で取得する', async () => {
  const { controller, nativeFetch } = await deliveryController();
  nativeFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ order: { ...delivery, status: 'delivering', isAssignedToMe: true } }),
    ),
  );
  expect((await receiveDelivery(controller, delivery.id)).order.status).toBe('delivering');
  expect(nativeFetch.mock.calls.at(-1)?.[0]).toBe(
    `http://api.example.test/courier/orders/${delivery.id}/receive`,
  );
  nativeFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ order: { ...delivery, status: 'delivered', isAssignedToMe: true } }),
    ),
  );
  expect((await completeDelivery(controller, delivery.id)).order.status).toBe('delivered');
  expect(nativeFetch.mock.calls.at(-1)?.[0]).toBe(
    `http://api.example.test/courier/orders/${delivery.id}/deliver`,
  );
  nativeFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        deliveries: [
          {
            id: delivery.id,
            storeName: delivery.storeName,
            total: 1000,
            deliveredAt: '2026-11-17T00:00:00.000Z',
          },
        ],
      }),
    ),
  );
  expect((await deliveryHistory(controller)).deliveries[0]?.id).toBe(delivery.id);
  expect(nativeFetch.mock.calls.at(-1)?.[0]).toBe('http://api.example.test/courier/orders/history');
});
