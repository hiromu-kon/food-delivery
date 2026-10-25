import type { AppType } from '@repo/api/app-type';
import { hc } from 'hono/client';
import { cookies } from 'next/headers';

import { env } from '@/env';

// Server Component からの呼び出しはブラウザの cookie を自動では送らないため、リクエストの cookie を転送する。
export async function createServerApiClient() {
  const cookieStore = await cookies();
  return hc<AppType>(env.NEXT_PUBLIC_API_URL, {
    headers: { cookie: cookieStore.toString() },
  });
}
