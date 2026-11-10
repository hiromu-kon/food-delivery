import type { MenuResponse } from '@repo/contract';
import { describe, expect, it, vi } from 'vitest';

import { SessionController } from '../auth/session';
import { MenuController } from './menu';

const user = {
  id: 'customer-a',
  name: '注文者',
  email: 'a@example.test',
  emailVerified: true,
  phoneNumber: '09012345678',
  role: 'customer' as const,
};
const item = (id: string, soldout = false) => ({
  id,
  name: id,
  description: '説明',
  price: 980,
  photoUrl: null,
  soldout,
  sortOrder: 0,
});
const menu = (id = 'a'): MenuResponse => ({
  store: {
    id,
    name: id,
    description: '',
    address: '合成住所',
    latitude: 35,
    longitude: 139,
    deliveryRadiusMeters: 3000,
    minimumOrderAmount: 500,
    isAcceptingOrders: false,
    photoUrl: null,
  },
  categories: [
    {
      id: 'z',
      name: '定食',
      description: '',
      photoUrl: null,
      sortOrder: 2,
      items: [item('z'), item('a', true)],
    },
    { id: 'a', name: '空カテゴリ', description: '', photoUrl: null, sortOrder: 0, items: [] },
  ],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup() {
  const me = vi.fn(() => Promise.resolve({ user }));
  const session = new SessionController(
    { read: () => Promise.resolve('signed'), write: async () => {}, clear: async () => {} },
    { me, signIn: () => Promise.resolve({ user, token: 'signed' }), signOut: async () => {} },
  );
  await session.restore();
  const fetchMenu = vi.fn((id: string) => Promise.resolve(menu(id)));
  const controller = new MenuController({ menu: fetchMenu }, session);
  const disconnect = controller.connect();
  controller.setRoute('a', true);
  await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('ready'));
  return { controller, fetchMenu, session, me, disconnect };
}
describe('メニュー Controller', () => {
  it('R-09 R-10 停止店・売り切れ・空カテゴリを保持しカテゴリも商品もAPI順を変えない', async () => {
    const { controller } = await setup();
    expect(controller.getSnapshot().menu).toEqual(menu());
    expect(controller.getSnapshot().menu?.categories.map((c) => c.id)).toEqual(['z', 'a']);
    expect(controller.getSnapshot().menu?.categories[0]?.items.map((i) => i.id)).toEqual([
      'z',
      'a',
    ]);
  });
  it('空メニューと通信エラーを区別し、再試行は前のメニューを残さない', async () => {
    const { controller, fetchMenu } = await setup();
    fetchMenu.mockRejectedValueOnce(new Error('offline'));
    await controller.reload();
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', menu: undefined });
    fetchMenu.mockResolvedValueOnce({ ...menu(), categories: [] });
    await controller.reload();
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', menu: { categories: [] } });
  });
  it('route切替・blur・unmountで消去し遅い旧店舗応答を捨てる', async () => {
    const { controller, fetchMenu, disconnect } = await setup();
    const slow = deferred<MenuResponse>();
    fetchMenu.mockReturnValueOnce(slow.promise);
    controller.setRoute('b', true);
    expect(controller.getSnapshot()).toMatchObject({
      storeId: 'b',
      menu: undefined,
      status: 'loading',
    });
    controller.setRoute('c', true);
    await vi.waitFor(() => expect(controller.getSnapshot().menu?.store.id).toBe('c'));
    slow.resolve(menu('b'));
    await slow.promise;
    expect(controller.getSnapshot().menu?.store.id).toBe('c');
    controller.setRoute(undefined, false);
    expect(controller.getSnapshot()).toMatchObject({ storeId: undefined, menu: undefined });
    const count = fetchMenu.mock.calls.length;
    await controller.reload();
    expect(fetchMenu).toHaveBeenCalledTimes(count);
    disconnect();
  });
  it('認証再確認・logout中の応答を捨て、同一routeの再認証後は取り直す', async () => {
    const { controller, fetchMenu, session, me } = await setup();
    const slow = deferred<MenuResponse>();
    const auth = deferred<{ user: typeof user }>();
    fetchMenu.mockReturnValueOnce(slow.promise);
    const pending = controller.reload();
    me.mockReturnValueOnce(auth.promise);
    const refresh = session.refresh();
    expect(controller.getSnapshot().menu).toBeUndefined();
    slow.resolve(menu('stale'));
    await pending;
    expect(controller.getSnapshot().menu).toBeUndefined();
    auth.resolve({ user });
    await refresh;
    await vi.waitFor(() => expect(controller.getSnapshot().menu?.store.id).toBe('a'));
    const late = deferred<MenuResponse>();
    fetchMenu.mockReturnValueOnce(late.promise);
    const old = controller.reload();
    await session.logout();
    late.resolve(menu('private'));
    await old;
    expect(controller.getSnapshot().menu).toBeUndefined();
    await session.login({ email: user.email, password: 'synthetic' });
    await vi.waitFor(() => expect(controller.getSnapshot().menu?.store.id).toBe('a'));
  });
});
