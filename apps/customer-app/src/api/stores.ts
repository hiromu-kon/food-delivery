import { storeSearchResponseSchema } from '@repo/contract';

import { AuthRequestError } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';
import type { StoreSearchTransport } from '@/features/stores/store-search';
import { createAddressTransport } from './addresses';
import { createApiClient } from './client';

function success(response: { ok: boolean; status: number }) {
  if (response.ok) return;
  throw new AuthRequestError(
    response.status === 404
      ? 'お届け先が見つかりません。再読み込みしてください。'
      : '店舗を取得できませんでした。再試行してください。',
    '',
    response.status,
  );
}

export function createStoreSearchTransport(session: SessionController): StoreSearchTransport {
  return {
    addresses: createAddressTransport(session).list,
    stores: (addressId) =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).stores.$get({ query: { addressId } });
        success(response);
        return storeSearchResponseSchema.parse(await response.json()).stores;
      }),
  };
}
