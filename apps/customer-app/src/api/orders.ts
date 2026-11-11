import { z } from 'zod';
import { customerOrderListResponseSchema, customerOrderDetailResponseSchema } from '@repo/contract';
import type { OrdersTransport } from '@/features/orders/orders';
import { env } from '@/env';
import { AuthRequestError } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';
import type { OrderRequest } from '@/features/checkout/checkout';
import { createApiClient, requestTimeoutMs } from './client';

// F-06 is intentionally local until the stacked API contract is available on this branch.
export function createOrderTransport(session: SessionController) {
  return (request: OrderRequest, key: string) =>
    session.authenticatedRequest(async (token) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetch(new URL('/orders', env.EXPO_PUBLIC_API_URL).href, {
          method: 'POST',
          credentials: 'omit',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        if (response.status !== 201) {
          const messages: Record<number, string> = {
            400: '注文内容を確認してください。',
            401: 'ログインの有効期限が切れました。',
            402: 'カードの承認に失敗したため注文は作成されませんでした。追加認証が必要なカードには対応していません。別のテストカードで再試行してください。',
            403: 'このアカウントでは注文できません。',
            404: '商品またはお届け先が見つかりません。',
            409: '注文状況を確認できません。同じ内容で再試行してください。',
            422: '在庫・配達範囲・カードの承認を確認してください。',
          };
          throw new AuthRequestError(
            messages[response.status] ?? '注文結果を確認できません。同じ内容で再試行してください。',
            '',
            response.status,
          );
        }
        return z.object({ order: z.object({ id: z.string().min(1) }) }).parse(await response.json())
          .order;
      } finally {
        clearTimeout(timeout);
      }
    });
}

export function createOrdersTransport(session: SessionController): OrdersTransport {
  return {
    list: () =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).orders.$get();
        if (!response.ok)
          throw new AuthRequestError(
            '注文履歴を取得できませんでした。再試行してください。',
            '',
            response.status,
          );
        return customerOrderListResponseSchema.parse(await response.json()).orders;
      }),
    detail: (id) =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).orders[':id'].$get({ param: { id } });
        if (!response.ok)
          throw new AuthRequestError(
            [400, 404].includes(response.status)
              ? '注文が見つかりません。注文履歴から選び直してください。'
              : '注文状況を取得できませんでした。再試行してください。',
            '',
            response.status,
          );
        return customerOrderDetailResponseSchema.parse(await response.json()).order;
      }),
  };
}
