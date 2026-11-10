import { apiClient } from '@/api/client';
import { assertAuthSuccess } from '@/features/auth/auth-form';

export const storeDeniedMessage = 'このアカウントは使えません。運営にお問い合わせください。';

// 失敗を握り潰さず、再試行するまで保護画面を表示しない。
export async function signOutStore() {
  const response = await apiClient.auth['sign-out'].$post();
  if (response.status !== 401) await assertAuthSuccess(response);
}
