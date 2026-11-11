import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.example.test' } }));
import { MenuEditor } from './menu-editor';
import {
  deleteMenuEntity,
  getManagedMenu,
  saveCategory,
  saveItem,
  setItemSoldout,
  MenuAccessError,
  checkMenuResponse,
} from './requests';

const categoryId = '00000000-0000-4000-8000-000000000001';
const itemId = '00000000-0000-4000-8000-000000000002';
const category = {
  id: categoryId,
  name: '定食',
  description: '',
  photoUrl: null,
  sortOrder: 0,
  items: [],
};
const item = {
  id: itemId,
  categoryId,
  name: '料理',
  description: '',
  photoUrl: null,
  sortOrder: 0,
  price: 850,
  soldout: false,
};
afterEach(() => vi.unstubAllGlobals());

describe('店舗メニュー管理', () => {
  it('実際のCRUD・売り切れルートにCookieとno-storeで送信し204を解析しない', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ categories: [category] }))
      .mockResolvedValueOnce(Response.json({ category }))
      .mockResolvedValueOnce(Response.json({ category }))
      .mockResolvedValueOnce(Response.json({ item }))
      .mockResolvedValueOnce(Response.json({ item }))
      .mockResolvedValueOnce(Response.json({ item: { ...item, soldout: true } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await getManagedMenu(new AbortController().signal);
    const categoryInput = { name: category.name, description: '', photoUrl: null, sortOrder: 0 };
    const itemInput = { ...categoryInput, categoryId, price: 850, soldout: false };
    await saveCategory(categoryInput);
    await saveCategory(categoryInput, categoryId);
    await saveItem(itemInput);
    await saveItem({ ...itemInput, photoUrl: null, price: 0 }, itemId);
    await expect(setItemSoldout(itemId, true)).resolves.toMatchObject({ soldout: true });
    await deleteMenuEntity('category', categoryId);
    await deleteMenuEntity('item', itemId);
    expect(
      fetch.mock.calls.map(([url, init]) => [
        new URL(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).pathname,
        init?.method ?? 'GET',
      ]),
    ).toEqual([
      ['/store/menu', 'GET'],
      ['/store/menu/categories', 'POST'],
      [`/store/menu/categories/${categoryId}`, 'PATCH'],
      ['/store/menu/items', 'POST'],
      [`/store/menu/items/${itemId}`, 'PATCH'],
      [`/store/menu/items/${itemId}/soldout`, 'PATCH'],
      [`/store/menu/categories/${categoryId}`, 'DELETE'],
      [`/store/menu/items/${itemId}`, 'DELETE'],
    ]);
    for (const [, init] of fetch.mock.calls)
      expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' });
    expect(JSON.parse(fetch.mock.calls[5]?.[1]?.body as string)).toEqual({ soldout: true });
    expect(JSON.parse(fetch.mock.calls[4]?.[1]?.body as string)).toMatchObject({
      photoUrl: null,
      price: 0,
    });
  });
  it('認証エラーをログインへ返し、400・404・サーバー失敗を操作失敗として伝える', () => {
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { replace } });
    for (const status of [401, 403])
      expect(() => checkMenuResponse(new Response(null, { status }))).toThrow(MenuAccessError);
    expect(replace.mock.calls).toEqual([['/store/login'], ['/store/login?reason=denied']]);
    for (const [status, message] of [
      [400, '入力内容'],
      [404, '見つかりません'],
      [503, '保存状態'],
    ] as const)
      expect(() => checkMenuResponse(new Response(null, { status }))).toThrow(message);
  });
  it('不正応答を成功表示せず、無効な入力は送信しない', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ categories: [{ name: 'broken' }] }));
    vi.stubGlobal('fetch', fetch);
    await expect(getManagedMenu(new AbortController().signal)).rejects.toThrow();
    await expect(saveItem({ ...item, price: -1 })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('画像の現行運用、値と商品移動先を編集画面に表示する', () => {
    const html = renderToStaticMarkup(
      createElement(MenuEditor, {
        editor: { kind: 'item', value: item, categoryId },
        categories: [category],
        busy: false,
        error: '',
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    for (const text of [
      '商品を編集',
      '税込価格',
      '850',
      '定食',
      'HTTPS',
      '直接アップロードはまだ利用できません',
      '空欄で保存すると画像の登録を解除',
    ])
      expect(html).toContain(text);
  });
});
