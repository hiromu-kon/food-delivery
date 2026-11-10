'use client';

import { z } from 'zod';
import { LogOutIcon } from 'lucide-react';
import { apiClient } from '@/api/client';
import { ListItem } from '@/components/ui/list-item';
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
      <ListItem
        title={form.pending ? 'ログアウト中…' : 'ログアウトする'}
        icon={<LogOutIcon />}
        tone="danger"
        chevron={false}
        disabled={form.pending}
        onClick={(event) => event.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
