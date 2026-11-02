import type { AppType } from '@repo/api/app-type';
import { hc } from 'hono/client';

import { env } from '@/env';

export const requestTimeoutMs = 10_000;

// Native でも Cookie jar に認証を委ねず、明示した署名付き Bearer だけを送る。
export function createApiClient(token?: string) {
  return hc<AppType>(env.EXPO_PUBLIC_API_URL, {
    init: { credentials: 'omit', cache: 'no-store' },
    ...(token && { headers: { Authorization: `Bearer ${token}` } }),
    fetch: async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        return await fetch(input instanceof URL ? input.href : input, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
export const apiClient = createApiClient();
