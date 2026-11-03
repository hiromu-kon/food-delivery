import type { DeliveryAddress, StoreSearchResult } from '@repo/contract';
import { describe, expect, it, vi } from 'vitest';

import { SessionController } from '../auth/session';
import { StoreSearchController } from './store-search';

const user = {
  id: 'user-a',
  name: '注文者',
  email: 'a@example.test',
  emailVerified: true,
  phoneNumber: '09012345678',
  role: 'customer' as const,
};
const address = (id: string, text = id): DeliveryAddress => ({
  id,
  address: text,
  building: '',
  deliveryNote: '',
  latitude: 35,
  longitude: 139,
});
const store = (id: string, canOrder = true): StoreSearchResult => ({
  id,
  name: id,
  description: '',
  address: '',
  latitude: 35,
  longitude: 139,
  deliveryRadiusMeters: 3000,
  minimumOrderAmount: 500,
  isAcceptingOrders: canOrder,
  canOrder,
  photoUrl: null,
  distanceMeters: 20,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup() {
  let currentUser = user;
  const me = vi.fn(() => Promise.resolve({ user: currentUser }));
  const session = new SessionController(
    { read: () => Promise.resolve('signed'), write: async () => {}, clear: async () => {} },
    {
      me,
      signIn: () => Promise.resolve({ user: currentUser, token: 'signed' }),
      signOut: async () => {},
    },
  );
  await session.restore();
  const addresses = vi.fn(() => Promise.resolve([address('a'), address('b')]));
  const stores = vi.fn((id: string) => Promise.resolve([store(id), store('paused', false)]));
  const controller = new StoreSearchController({ addresses, stores }, session);
  const disconnect = controller.connect();
  controller.setFocused(true);
  await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
  return {
    controller,
    addresses,
    stores,
    session,
    me,
    disconnect,
    changeUser: () => {
      currentUser = { ...user, id: 'user-b' };
    },
  };
}
describe('店舗検索 Controller', () => {
  it('本人住所の先頭を選び、停止店もAPI順で表示する', async () => {
    const { controller, stores } = await setup();
    expect(stores).toHaveBeenCalledWith('a');
    expect(controller.getSnapshot()).toMatchObject({
      selectedId: 'a',
      stores: [store('a'), store('paused', false)],
    });
    await controller.select('b');
    expect(controller.getSnapshot().selectedId).toBe('b');
    expect(controller.getSnapshot().stores[0]?.id).toBe('b');
  });
  it('切替直後に店舗を消去し、逆順で届く古い検索結果を捨てる', async () => {
    const { controller, stores } = await setup();
    const slow = deferred<StoreSearchResult[]>();
    stores.mockImplementationOnce(() => slow.promise);
    const pending = controller.select('b');
    expect(controller.getSnapshot()).toMatchObject({
      selectedId: 'b',
      stores: [],
      status: 'loading',
    });
    await controller.select('a');
    slow.resolve([store('old-b')]);
    await pending;
    expect(controller.getSnapshot()).toMatchObject({
      selectedId: 'a',
      stores: [store('a'), store('paused', false)],
    });
  });
  it('通信失敗時に古い店舗を出さず、再試行で住所も更新する', async () => {
    const { controller, stores, addresses } = await setup();
    stores.mockRejectedValueOnce(new Error('offline'));
    await controller.select('b');
    expect(controller.getSnapshot()).toMatchObject({ stores: [], status: 'error' });
    addresses.mockResolvedValueOnce([address('b', '編集後')]);
    await controller.reload();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      selectedId: 'b',
      addresses: [address('b', '編集後')],
    });
  });
  it('focus復帰で編集・削除を再取得し古い店舗を残さない、未登録も扱う', async () => {
    const { controller, addresses } = await setup();
    controller.setFocused(false);
    expect(controller.getSnapshot().stores).toEqual([]);
    addresses.mockResolvedValueOnce([address('b', '移転後')]);
    controller.setFocused(true);
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
    expect(controller.getSnapshot()).toMatchObject({
      selectedId: 'b',
      stores: [store('b'), store('paused', false)],
    });
    addresses.mockResolvedValueOnce([]);
    await controller.reload();
    expect(controller.getSnapshot()).toMatchObject({
      addresses: [],
      stores: [],
      selectedId: undefined,
      status: 'ready',
    });
  });
  it('住所取得失敗・圏内なしを区別し、住所の遅い再取得も無効化する', async () => {
    const { controller, addresses, stores } = await setup();
    addresses.mockRejectedValueOnce(new Error('offline'));
    await controller.reload();
    expect(controller.getSnapshot()).toMatchObject({ addresses: [], stores: [], status: 'error' });
    stores.mockResolvedValueOnce([]);
    await controller.reload();
    expect(controller.getSnapshot()).toMatchObject({
      selectedId: 'a',
      stores: [],
      status: 'ready',
    });
    const slow = deferred<DeliveryAddress[]>();
    addresses.mockImplementationOnce(() => slow.promise);
    const old = controller.reload();
    addresses.mockResolvedValueOnce([address('b')]);
    await controller.reload();
    slow.resolve([address('old')]);
    await old;
    expect(controller.getSnapshot().selectedId).toBe('b');
  });
  it('ログアウト中の応答と別userの住所選択を破棄する', async () => {
    const { controller, stores, session, changeUser } = await setup();
    const slow = deferred<StoreSearchResult[]>();
    stores.mockImplementationOnce(() => slow.promise);
    const pending = controller.select('b');
    await session.logout();
    expect(controller.getSnapshot()).toMatchObject({
      addresses: [],
      stores: [],
      selectedId: undefined,
    });
    slow.resolve([store('private')]);
    await pending;
    expect(controller.getSnapshot().stores).toEqual([]);
    changeUser();
    await session.login({ email: 'b@example.test', password: 'test' });
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
    expect(controller.getSnapshot().selectedId).toBe('a');
  });
  it('バックグラウンド認証再確認中の応答を捨て、成功後に再検索する', async () => {
    const { controller, stores, session, me } = await setup();
    const old = deferred<StoreSearchResult[]>();
    const auth = deferred<{ user: typeof user }>();
    stores.mockImplementationOnce(() => old.promise);
    const pending = controller.select('b');
    me.mockImplementationOnce(() => auth.promise);
    const refresh = session.refresh();
    expect(controller.getSnapshot().stores).toEqual([]);
    old.resolve([store('stale')]);
    await pending;
    expect(controller.getSnapshot().stores).toEqual([]);
    auth.resolve({ user });
    await refresh;
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
    expect(controller.getSnapshot().selectedId).toBe('b');
    expect(controller.getSnapshot().stores[0]?.id).toBe('b');
  });
});
