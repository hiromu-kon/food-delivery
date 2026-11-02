'use client';

import { z } from 'zod';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { assertAuthSuccess, FormError, useAuthForm } from './auth-form';

export function LogoutButton() {
  const form = useAuthForm(z.object({}), async () => {
    const response = await apiClient.auth['sign-out'].$post();
    if (response.status !== 401) await assertAuthSuccess(response);
    window.location.replace('/login');
  });
  return (
    <form onSubmit={(event) => void form.onSubmit(event)} className="space-y-4">
      <FormError error={form.error} />
      <Button type="submit" variant="secondary" className="w-full" loading={form.pending}>
        ログアウトする
      </Button>
    </form>
  );
}
