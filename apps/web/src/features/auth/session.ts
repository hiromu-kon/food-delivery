import { authUserSchema } from '@repo/contract';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';

import { createServerApiClient } from '@/api/server';

export const getSession = cache(async () => {
  const client = await createServerApiClient();
  const response: Response = await client.auth.me.$get();
  if (response.status === 401) return { user: null, blocked: false };
  if (response.status === 403) return { user: null, blocked: true };
  if (!response.ok) throw new Error('認証の状態を確認できませんでした');
  const { user } = z.object({ user: authUserSchema }).parse(await response.json());
  return { user, blocked: false };
});

export async function requireCustomer() {
  const { user, blocked } = await getSession();
  if (blocked || (user && user.role !== 'customer')) redirect('/access-denied');
  if (!user) redirect('/login');
  return user;
}
