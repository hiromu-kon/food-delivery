import type { AppType } from '@repo/api/app-type';
import { hc } from 'hono/client';

import { env } from '@/env';

export const apiClient = hc<AppType>(env.NEXT_PUBLIC_API_URL, {
  init: { credentials: 'include' },
});
