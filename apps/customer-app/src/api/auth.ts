import { authUserSchema } from '@repo/contract';

import { assertAuthSuccess, AuthRequestError } from '@/features/auth/request';
import type { SessionTransport } from '@/features/auth/session';
import { createApiClient } from './client';

export const sessionTransport: SessionTransport = {
  async signIn(credentials) {
    const response = await createApiClient().auth['sign-in'].email.$post({ json: credentials });
    await assertAuthSuccess(response);
    const result = await response.json();
    const token = response.headers.get('set-auth-token');
    if (!token || !('user' in result))
      throw new AuthRequestError('認証情報を受け取れませんでした。');
    return { user: authUserSchema.parse(result.user), token };
  },
  async me(token) {
    const response = await createApiClient(token).auth.me.$get();
    await assertAuthSuccess(response);
    const result = await response.json();
    const renewedToken = response.headers.get('set-auth-token');
    return {
      user: authUserSchema.parse(result.user),
      ...(renewedToken && { token: renewedToken }),
    };
  },
  async signOut(token) {
    await assertAuthSuccess(await createApiClient(token).auth['sign-out'].$post());
  },
};
