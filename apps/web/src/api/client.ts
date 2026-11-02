import type { AppType } from '@repo/api/app-type';
import { hc } from 'hono/client';

import { env } from '@/env';

export const apiClient = hc<AppType>(env.NEXT_PUBLIC_API_URL, {
  init: { credentials: 'include', cache: 'no-store' },
  fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) }),
});
