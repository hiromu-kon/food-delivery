import { z } from 'zod';
import { addressSchema } from '@repo/contract';

import { AuthRequestError } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';
import type { AddressTransport } from '@/features/addresses/addresses';
import { createApiClient } from './client';

function success(response: { ok: boolean; status: number }) {
  if (response.ok) return;
  const messages: Record<number, string> = {
    400: '入力内容を確認してください。',
    401: 'ログインの有効期限が切れました。',
    403: 'このアカウントでは利用できません。',
    404: 'お届け先が見つかりません。一覧を再読み込みしてください。',
    422: '住所を確認できませんでした。番地などを確認して再試行してください。',
    503: '住所確認サービスを利用できません。時間をおいて再試行してください。',
  };
  throw new AuthRequestError(
    messages[response.status] ?? '処理できませんでした。再試行してください。',
    '',
    response.status,
  );
}
export function createAddressTransport(session: SessionController): AddressTransport {
  return {
    list: () =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).addresses.$get();
        success(response);
        return addressSchema.array().parse((await response.json()).addresses);
      }),
    create: (json) =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).addresses.$post({ json });
        success(response);
        return z.object({ address: addressSchema }).parse(await response.json()).address;
      }),
    update: (id, json) =>
      session.authenticatedRequest(async (token) => {
        const response = await createApiClient(token).addresses[':id'].$patch({
          param: { id },
          json,
        });
        success(response);
        return z.object({ address: addressSchema }).parse(await response.json()).address;
      }),
    remove: (id) =>
      session.authenticatedRequest(async (token) => {
        success(await createApiClient(token).addresses[':id'].$delete({ param: { id } }));
      }),
  };
}
