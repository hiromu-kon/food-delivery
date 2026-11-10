import {
  customerOrderDetailResponseSchema,
  customerOrderListResponseSchema,
  type OrderDetail,
  type OrderSummary,
} from '@repo/contract';
import { apiClient } from '@/api/client';

export class OrderReadError extends Error {}
export class OrderAccessError extends OrderReadError {}
export class OrderNotFoundError extends OrderReadError {}

function checkResponse(response: Response) {
  if (response.status === 401 || response.status === 403) {
    window.location.replace(response.status === 401 ? '/login' : '/access-denied');
    throw new OrderAccessError('ログイン状態を確認してください。');
  }
  if (response.status === 404 || response.status === 400)
    throw new OrderNotFoundError('注文が見つかりません。注文履歴から選び直してください。');
  if (!response.ok)
    throw new OrderReadError('注文を取得できませんでした。もう一度お試しください。');
}

export async function getOrders(signal: AbortSignal): Promise<OrderSummary[]> {
  const response = await apiClient.orders.$get(undefined, {
    init: { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
  });
  checkResponse(response);
  return customerOrderListResponseSchema.parse(await response.json()).orders;
}

export async function getOrder(id: string, signal: AbortSignal): Promise<OrderDetail> {
  const response = await apiClient.orders[':id'].$get(
    { param: { id } },
    { init: { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) } },
  );
  checkResponse(response);
  return customerOrderDetailResponseSchema.parse(await response.json()).order;
}
