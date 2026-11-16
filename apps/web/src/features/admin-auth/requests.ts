import { apiClient } from '@/api/client';
import { assertAuthSuccess } from '@/features/auth/auth-form';

export const adminDeniedMessage = '運営権限がありません。管理者にお問い合わせください。';

export async function signOutAdmin() {
  const response = await apiClient.auth['sign-out'].$post();
  if (response.status !== 401) await assertAuthSuccess(response);
}
