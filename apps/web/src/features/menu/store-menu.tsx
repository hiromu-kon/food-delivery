'use client';

import type { MenuResponse } from '@repo/contract';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { MenuContent } from './menu-content';
import { MenuError, MenuRequests, menuErrorMessage, readMenu } from './menu-state';

export function StoreMenu({ storeId }: { storeId: string }) {
  const [menu, setMenu] = useState<MenuResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requests = useRef(new MenuRequests());
  const load = useCallback(() => {
    void requests.current.run(
      async () =>
        readMenu(await apiClient.stores[':storeId'].menu.$get({ param: { storeId }, query: {} })),
      (result) => {
        setMenu(result);
        setLoading(false);
      },
      (cause) => {
        setLoading(false);
        if (cause instanceof MenuError && cause.status === 401) window.location.replace('/login');
        else if (cause instanceof MenuError && cause.status === 403)
          window.location.replace('/access-denied');
        else setError(menuErrorMessage(cause));
      },
    );
  }, [storeId]);

  const reload = useCallback(() => {
    setMenu(undefined);
    setError('');
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const active = requests.current;
    load();
    const refresh = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active.cancel();
      // Next の履歴保持で画面が隠れる場合も、再表示時に前回の内容を残さない。
      setMenu(undefined);
      setError('');
      setLoading(true);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, reload]);

  return (
    <main className="mx-auto w-full max-w-200" aria-busy={loading}>
      <Link
        href="/"
        className="text-label-m text-brand flex min-h-14 w-fit items-center gap-2 px-4 py-3 focus-visible:outline-2 focus-visible:outline-(--border-color-focus)"
      >
        <ArrowLeftIcon className="size-5" aria-hidden />
        店舗一覧に戻る
      </Link>
      {loading && (
        <p role="status" className="text-body-m text-secondary p-6">
          メニューを確認しています…
        </p>
      )}
      {error && (
        <div className="space-y-4 p-4">
          <NoticeBanner tone="danger" role="alert">
            {error}
          </NoticeBanner>
          <Button variant="secondary" onClick={reload}>
            もう一度試す
          </Button>
        </div>
      )}
      {menu && menu.store.id === storeId && <MenuContent menu={menu} />}
    </main>
  );
}
