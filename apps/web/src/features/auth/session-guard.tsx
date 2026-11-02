'use client';

import { authUserSchema } from '@repo/contract';
import { z } from 'zod';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { apiClient } from '@/api/client';

// layout は画面移動ごとには実行されないため、移動・タブ復帰・履歴復元でも確認する。
// データへのアクセス制御は、常に API の認証・認可を正とする。
export function SessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const response: Response = await apiClient.auth.me.$get(undefined, {
          init: { cache: 'no-store' },
        });
        if (!active) return;
        if (response.status === 401) window.location.replace('/login');
        else if (response.status === 403) window.location.replace('/access-denied');
        else if (response.ok) {
          const result = z.object({ user: authUserSchema }).parse(await response.json());
          if (result.user.role !== 'customer') window.location.replace('/access-denied');
        }
      } catch {
        /* 通信失敗だけではログアウトしない。API を使う操作側で再試行を案内する */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verify();
    };
    void verify();
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);
  return children;
}
