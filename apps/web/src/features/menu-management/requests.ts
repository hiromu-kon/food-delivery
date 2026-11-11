import {
  categoryCreateSchema,
  categoryResponseSchema,
  itemCreateSchema,
  itemResponseSchema,
  managedMenuSchema,
} from '@repo/contract';
import type { z } from 'zod';

import { apiClient } from '@/api/client';

export type ManagedMenu = z.infer<typeof managedMenuSchema>;
export type Category = ManagedMenu['categories'][number];
export type Item = Category['items'][number];
export type CategoryInput = z.infer<typeof categoryCreateSchema>;
export type ItemInput = z.infer<typeof itemCreateSchema>;

export class MenuManagementError extends Error {}
export class MenuAccessError extends MenuManagementError {}

export function checkMenuResponse(response: Response) {
  if (response.status === 401 || response.status === 403) {
    window.location.replace(
      response.status === 401 ? '/store/login' : '/store/login?reason=denied',
    );
    throw new MenuAccessError('店舗の利用権限を確認してください。');
  }
  if (response.status === 404)
    throw new MenuManagementError('対象が見つかりません。一覧を再読み込みしてください。');
  if (response.status === 400)
    throw new MenuManagementError('入力内容を確認してください。変更は保存されていません。');
  if (!response.ok)
    throw new MenuManagementError(
      '通信に失敗しました。一覧で保存状態を確認してから再試行してください。',
    );
}

export function menuManagementMessage(error: unknown) {
  return error instanceof MenuManagementError
    ? error.message
    : '通信または応答の確認に失敗しました。一覧で保存状態を確認してから再試行してください。';
}

const menu = apiClient.store.menu;
export async function getManagedMenu(signal: AbortSignal) {
  const response = await menu.$get(undefined, {
    init: { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
  });
  signal.throwIfAborted();
  checkMenuResponse(response);
  return managedMenuSchema.parse(await response.json());
}
export async function saveCategory(input: CategoryInput, id?: string) {
  const json = categoryCreateSchema.parse(input);
  const response = id
    ? await menu.categories[':categoryId'].$patch({ param: { categoryId: id }, json })
    : await menu.categories.$post({ json });
  checkMenuResponse(response);
  return categoryResponseSchema.parse(await response.json()).category;
}
export async function saveItem(input: ItemInput, id?: string) {
  const json = itemCreateSchema.parse(input);
  const response = id
    ? await menu.items[':itemId'].$patch({ param: { itemId: id }, json })
    : await menu.items.$post({ json });
  checkMenuResponse(response);
  return itemResponseSchema.parse(await response.json()).item;
}
export async function deleteMenuEntity(kind: 'category' | 'item', id: string) {
  const response =
    kind === 'category'
      ? await menu.categories[':categoryId'].$delete({ param: { categoryId: id } })
      : await menu.items[':itemId'].$delete({ param: { itemId: id } });
  checkMenuResponse(response);
}
export async function setItemSoldout(id: string, soldout: boolean) {
  const response = await menu.items[':itemId'].soldout.$patch({
    param: { itemId: id },
    json: { soldout },
  });
  checkMenuResponse(response);
  return itemResponseSchema.parse(await response.json()).item;
}
