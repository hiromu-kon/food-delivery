import { courierMeSchema } from '@repo/contract';

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
    try {
      const me = await this.me(token);
      return { user: me.user, token: me.token ?? token };
    } catch (error) {
      // 失効APIに接続できなくても、配達員と確認できなかった認証情報は端末に保存しない。
      await this.signOut(token).catch(() => undefined);
      throw error;
    }
  },
  async me(token) {
    const response = await createApiClient(token).courier.me.$get();
    await assertAuthSuccess(response);
    const result = await response.json();
    const renewedToken = response.headers.get('set-auth-token');
    return {
      user: courierMeSchema.parse(result).user,
      ...(renewedToken && { token: renewedToken }),
    };
  },
  async signOut(token) {
    await assertAuthSuccess(await createApiClient(token).auth['sign-out'].$post());
  },
};
