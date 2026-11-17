import {
  adminOrderDetailResponseSchema,
  adminOrderListResponseSchema,
  type AdminOrderQuery,
} from '@repo/contract';
import { apiClient } from '@/api/client';

async function checked(response: Response) {
  if (response.status === 401 || response.status === 403) {
    window.location.replace('/admin/login?reason=denied');
    throw new Error('運営の利用状態を確認してください');
  }
  if (response.status === 503)
    throw new Error(
      '返金結果が未確認です。接続とテスト用返金設定を確認し、返金を再確認してください。',
    );
  if (response.status === 409) throw new Error('注文状態が変わりました。再読み込みしてください。');
  if (!response.ok)
    throw new Error('注文を確認できませんでした。入力と接続を確認して再試行してください。');
  const body: unknown = await response.json();
  return body;
}
export async function listAdminOrders(query: AdminOrderQuery, signal: AbortSignal) {
  const response: Response = await apiClient.admin.orders.$get({ query }, { init: { signal } });
  return adminOrderListResponseSchema.parse(await checked(response)).orders;
}
export async function getAdminOrder(id: string, signal: AbortSignal) {
  const response: Response = await apiClient.admin.orders[':id'].$get(
    { param: { id } },
    { init: { signal } },
  );
  return adminOrderDetailResponseSchema.parse(await checked(response)).order;
}
export async function updateAdminOrder(
  id: string,
  action: 'cancel' | 'unassign',
  signal: AbortSignal,
) {
  const endpoint = apiClient.admin.orders[':id'];
  const response: Response =
    action === 'cancel'
      ? await endpoint.cancel.$post({ param: { id } }, { init: { signal } })
      : await endpoint.unassign.$post({ param: { id } }, { init: { signal } });
  return adminOrderDetailResponseSchema.parse(await checked(response)).order;
}
