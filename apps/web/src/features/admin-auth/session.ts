import { adminMeResponseSchema } from '@repo/contract';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createServerApiClient } from '@/api/server';

export const requireAdminContext = cache(async () => {
  const client = await createServerApiClient();
  const response: Response = await client.admin.me.$get({ query: {} });
  if (response.status === 401) redirect('/admin/login');
  if (response.status === 403) redirect('/admin/login?reason=denied');
  if (!response.ok) throw new Error('運営の利用状態を確認できませんでした');
  return adminMeResponseSchema.parse(await response.json());
});
