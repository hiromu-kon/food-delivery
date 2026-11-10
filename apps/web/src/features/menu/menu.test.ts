import type { MenuResponse } from '@repo/contract';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MenuContent } from './menu-content';
import { MenuError, MenuRequests, menuErrorMessage, readMenu } from './menu-state';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = (n: number, soldout = false) => ({
  id: id(n),
  name: `商品${n}`,
  description: `説明${n}`,
  price: n * 100,
  photoUrl: null,
  soldout,
  sortOrder: n,
});
const menu: MenuResponse = {
  store: {
    id: id(1),
    name: '検証食堂',
    description: '店舗の説明',
    address: '検証住所',
    latitude: 35,
    longitude: 139,
    deliveryRadiusMeters: 3000,
    minimumOrderAmount: 1000,
    isAcceptingOrders: false,
    photoUrl: null,
  },
  categories: [
    {
      id: id(2),
      name: '定食',
      description: 'カテゴリの説明',
      photoUrl: null,
      sortOrder: 0,
      items: [item(5, true), item(4)],
    },
    { id: id(3), name: '飲み物', description: '', photoUrl: null, sortOrder: 1, items: [] },
  ],
};
function deferred() {
  let resolve!: (menu: MenuResponse) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<MenuResponse>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('メニューの表示と取得', () => {
  it('API応答の店舗・カテゴリ・商品順を保ち、売り切れも価格と説明を表示する', async () => {
    const result = await readMenu(Response.json(menu));
    const html = renderToStaticMarkup(createElement(MenuContent, { menu: result }));
    for (const text of [
      '検証食堂',
      '店舗の説明',
      '検証住所',
      '配達料',
      '¥300',
      '受付停止中',
      'カテゴリの説明',
      '商品5',
      '説明5',
      '¥500',
      '売り切れ',
      '商品4',
    ])
      expect(html).toContain(text);
    expect(html.indexOf('heading-' + id(2))).toBeLessThan(html.indexOf('heading-' + id(3)));
    expect(html.indexOf('商品5')).toBeLessThan(html.indexOf('商品4'));
    expect(html).not.toContain('カート');
    expect(html).not.toContain('<button');
    expect(html).toContain('このカテゴリにはまだ商品がありません');
  });
  it('追加操作では販売中のみボタンを表示し、復元前は無効にする', () => {
    const html = renderToStaticMarkup(
      createElement(MenuContent, { menu, onAdd: vi.fn(), cartReady: true }),
    );
    expect(html).toContain('商品4をカートに入れる');
    expect(html).not.toContain('商品5をカートに入れる');
    expect(html).not.toContain('disabled=');
    const loading = renderToStaticMarkup(createElement(MenuContent, { menu, onAdd: vi.fn() }));
    expect(loading).toContain('disabled=');
  });
  it('写真がある店舗・カテゴリ・商品は写真を表示する', () => {
    const photo = 'data:image/png;base64,iVBORw0KGgo=';
    const result = {
      ...menu,
      store: { ...menu.store, photoUrl: photo },
      categories: [
        { ...menu.categories[0]!, photoUrl: photo, items: [{ ...item(4), photoUrl: photo }] },
      ],
    };
    const html = renderToStaticMarkup(createElement(MenuContent, { menu: result }));
    expect(html).toContain('検証食堂の料理');
    expect(html).toContain('定食の写真');
    expect(html).toContain('商品4の写真');
  });
  it('カテゴリなしは有効な空メニューとして表示する', () => {
    const html = renderToStaticMarkup(
      createElement(MenuContent, { menu: { ...menu, categories: [] } }),
    );
    expect(html).toContain('メニューはまだ登録されていません');
    expect(html).not.toContain('メニューのカテゴリ');
  });
  it.each([400, 401, 403, 404, 500])(
    'HTTP %s を成功扱いせず、状態を呼び出し側へ渡す',
    async (status) => {
      await expect(readMenu(new Response(null, { status }))).rejects.toMatchObject({ status });
    },
  );
  it('不正応答を拒否し、404と接続失敗に回復方法を案内する', async () => {
    await expect(readMenu(Response.json({ store: menu.store }))).rejects.toThrow();
    expect(menuErrorMessage(new MenuError(404))).toContain('店舗一覧');
    expect(menuErrorMessage(new Error('offline'))).toContain('もう一度');
  });
  it.each(['success', '401', '403', '500'])('古いルートの %s 応答を破棄する', async (outcome) => {
    const requests = new MenuRequests();
    const old = deferred();
    const update = vi.fn<(menu: MenuResponse) => void>();
    const fail = vi.fn();
    const first = requests.run(() => old.promise, update, fail);
    await requests.run(() => Promise.resolve({ ...menu, categories: [] }), update, fail);
    if (outcome === 'success') old.resolve(menu);
    else old.reject(new MenuError(Number(outcome)));
    await first;
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0].categories).toEqual([]);
    expect(fail).not.toHaveBeenCalled();
  });
  it('離脱後の成功・認証エラーを破棄する', async () => {
    for (const failure of [false, true]) {
      const requests = new MenuRequests();
      const old = deferred();
      const update = vi.fn<(menu: MenuResponse) => void>();
      const fail = vi.fn();
      const first = requests.run(() => old.promise, update, fail);
      requests.cancel();
      if (failure) old.reject(new MenuError(401));
      else old.resolve(menu);
      await first;
      expect(update).not.toHaveBeenCalled();
      expect(fail).not.toHaveBeenCalled();
    }
  });
  it('失敗後に同じ取得処理で再試行できる', async () => {
    const requests = new MenuRequests();
    const update = vi.fn<(menu: MenuResponse) => void>();
    const fail = vi.fn();
    await requests.run(() => Promise.reject(new MenuError(500)), update, fail);
    await requests.run(() => Promise.resolve(menu), update, fail);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(menu);
  });
});
