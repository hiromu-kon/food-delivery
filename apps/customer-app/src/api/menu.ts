import { menuResponseSchema } from '@repo/contract';

import { AuthRequestError } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';
import type { MenuTransport } from '@/features/menu/menu';
import { createApiClient } from './client';

export function createMenuTransport(session: SessionController): MenuTransport {
  return {
    menu: (storeId) =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).stores[':storeId'].menu.$get({
          param: { storeId },
          query: {},
        });
        const status: number = response.status;
        if (!response.ok)
          throw new AuthRequestError(
            status === 404
              ? '店舗が見つかりません。お店の一覧から選び直してください。'
              : 'メニューを取得できませんでした。再試行してください。',
            '',
            response.status,
          );
        return menuResponseSchema.parse(await response.json());
      }),
  };
}
