import {
  apiErrorSchema,
  managedStoreSchema,
  managedStoresSchema,
  managedStaffSchema,
  storeCreateSchema,
  staffCreateSchema,
} from '@repo/contract';
import type { z } from 'zod';

import { apiClient } from '@/api/client';

export type ManagedStore = z.infer<typeof managedStoreSchema>['store'];
export type StoreInput = z.infer<typeof storeCreateSchema>;
export type StaffInput = z.infer<typeof staffCreateSchema>;
const stores = apiClient.admin.stores;
export class StoreAdminError extends Error {}
export function storeAdminMessage(error: unknown) {
  return error instanceof StoreAdminError
    ? error.message
    : '通信結果を確認できませんでした。再読み込みして保存状態を確認してください。';
}
async function check(response: Response, signal: AbortSignal) {
  signal.throwIfAborted();
  if (response.status === 401 || response.status === 403) {
    window.location.replace(
      response.status === 401 ? '/admin/login' : '/admin/login?reason=denied',
    );
    throw new StoreAdminError('運営権限を確認してください。');
  }
  if (!response.ok) {
    const result = apiErrorSchema.safeParse(await response.json());
    throw new StoreAdminError(
      result.success ? result.data.message : '処理できませんでした。再読み込みしてください。',
    );
  }
}
const options = (signal: AbortSignal) => ({
  init: { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
});
export async function listStores(signal: AbortSignal) {
  const response = await stores.$get(undefined, options(signal));
  await check(response, signal);
  return managedStoresSchema.parse(await response.json()).stores;
}
export async function getStore(storeId: string, signal: AbortSignal) {
  const response = await stores[':storeId'].$get({ param: { storeId } }, options(signal));
  await check(response, signal);
  return managedStoreSchema.parse(await response.json()).store;
}
export async function saveStore(input: StoreInput, signal: AbortSignal, storeId?: string) {
  const json = storeCreateSchema.parse(input);
  const response = storeId
    ? await stores[':storeId'].$patch({ param: { storeId }, json }, options(signal))
    : await stores.$post({ json }, options(signal));
  await check(response, signal);
  return managedStoreSchema.parse(await response.json()).store;
}
export async function deleteStore(storeId: string, signal: AbortSignal) {
  const response = await stores[':storeId'].$delete({ param: { storeId } }, options(signal));
  await check(response, signal);
}
export async function issueStaff(storeId: string, input: StaffInput, signal: AbortSignal) {
  const response = await stores[':storeId'].staff.$post(
    { param: { storeId }, json: staffCreateSchema.parse(input) },
    options(signal),
  );
  await check(response, signal);
  return managedStaffSchema.parse(await response.json()).staff;
}
