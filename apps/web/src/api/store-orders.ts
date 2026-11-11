import { storeOrderDetailResponseSchema, storeOrderListResponseSchema } from '@repo/contract';
import { apiClient } from './client';

export class StoreOrderError extends Error {
  constructor(
    message: string,
    readonly stop = false,
    readonly retrySame = false,
  ) {
    super(message);
  }
}
export function checkStoreOrderResponse(response: Response) {
  if (response.status === 401 || response.status === 403) {
    window.location.replace(
      response.status === 401 ? '/store/login' : '/store/login?reason=denied',
    );
    throw new StoreOrderError('ログイン状態を確認してください。', true);
  }
  if (response.status === 404 || response.status === 400)
    throw new StoreOrderError('注文が見つかりません。注文一覧から選び直してください。', true);
  if (response.status === 409)
    throw new StoreOrderError(
      '注文状態または受付期限が変わりました。最新の状態を確認してください。',
    );
  if (!response.ok)
    throw new StoreOrderError(
      '結果を確認できません。再読み込みし、決済確認中の場合は同じ操作で再確認してください。',
      false,
      true,
    );
}
const options = (signal: AbortSignal) => ({
  init: { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) },
});
export async function getStoreOrders(signal: AbortSignal) {
  const response = await apiClient.store.orders.$get(undefined, options(signal));
  checkStoreOrderResponse(response);
  return storeOrderListResponseSchema.parse(await response.json()).orders;
}
export async function getStoreOrder(id: string, signal: AbortSignal) {
  const response = await apiClient.store.orders[':id'].$get({ param: { id } }, options(signal));
  checkStoreOrderResponse(response);
  const order = storeOrderDetailResponseSchema.parse(await response.json()).order;
  if (order.id !== id) throw new StoreOrderError('注文を確認できません。再読み込みしてください。');
  return order;
}
export async function actOnStoreOrder(
  id: string,
  action: 'accept' | 'reject' | 'ready',
  signal: AbortSignal,
) {
  const route = apiClient.store.orders[':id'];
  const request = { param: { id } };
  const response =
    action === 'accept'
      ? await route.accept.$post(request, options(signal))
      : action === 'reject'
        ? await route.reject.$post(request, options(signal))
        : await route.ready.$post(request, options(signal));
  checkStoreOrderResponse(response);
  const order = storeOrderDetailResponseSchema.parse(await response.json()).order;
  if (order.id !== id)
    throw new StoreOrderError('結果を確認できません。同じ注文を再読み込みしてください。');
  return order;
}
