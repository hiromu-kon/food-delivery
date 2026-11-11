import {
  customerOrderCancellationResponseSchema,
  customerOrderDetailResponseSchema,
  customerOrderListResponseSchema,
  type OrderDetail,
  type OrderSummary,
} from '@repo/contract';
import { apiClient } from '@/api/client';

export class OrderReadError extends Error {}
export class OrderAccessError extends OrderReadError {}
export class OrderNotFoundError extends OrderReadError {}
export class OrderConflictError extends OrderReadError {}

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

export async function cancelOrder(id: string): Promise<void> {
  const response = await apiClient.orders[':id'].cancel.$post(
    { param: { id } },
    { init: { signal: AbortSignal.timeout(30_000) } },
  );
  if ([400, 401, 403, 404].includes(response.status)) checkResponse(response);
  if (response.status === 409)
    throw new OrderConflictError(
      '受付済みなどのため取り消せません。最新の注文状況を確認してください。',
    );
  if (!response.ok)
    throw new OrderReadError(
      '決済の取消を確認できません。注文がキャンセル表示でも、決済取消を再確認してください。',
    );
  const result = customerOrderCancellationResponseSchema.parse(await response.json());
  if (result.order.id !== id) throw new Error('Unexpected order');
}
