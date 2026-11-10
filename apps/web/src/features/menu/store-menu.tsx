'use client';

import type { MenuResponse } from '@repo/contract';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { useRouter } from 'next/navigation';
import { calculateCartTotals } from '@repo/domain';
import { CartBar } from '@/components/ui/cart-bar';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useCart } from '@/features/cart/cart-provider';
import type { MenuProduct } from '@/features/cart/cart-state';
import { MenuContent } from './menu-content';
import { MenuError, MenuRequests, menuErrorMessage, readMenu } from './menu-state';

export function StoreMenu({ storeId }: { storeId: string }) {
  const router = useRouter();
  const cart = useCart();
  const [pending, setPending] = useState<{ menu: MenuResponse; item: MenuProduct }>();
  const [cartMessage, setCartMessage] = useState('');
  const totals = calculateCartTotals(cart.cart?.items ?? []);
  const add = (currentMenu: MenuResponse, item: MenuProduct, confirmed = false) => {
    const result = cart.actions.add(currentMenu.store, item, confirmed);
    if (result === 'confirmation-required') setPending({ menu: currentMenu, item });
    else
      setCartMessage(
        result === 'updated'
          ? `${item.name}をカートに入れました。`
          : '商品を追加できません。数量は1商品につき20点までです。',
      );
  };
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
      {cart.notice && (
        <NoticeBanner tone="warning" role="alert">
          {cart.notice}
        </NoticeBanner>
      )}
      <p role="status" className="text-body-s text-secondary px-4">
        {cartMessage}
      </p>
      {menu && menu.store.id === storeId && (
        <MenuContent menu={menu} cartReady={cart.ready} onAdd={(item) => add(menu, item)} />
      )}
      {cart.ready && totals.status === 'ok' && cart.cart && (
        <div className="bg-base sticky bottom-0 z-20 mx-auto max-w-200 p-4">
          <CartBar
            count={cart.cart.items.reduce((count, item) => count + item.quantity, 0)}
            subtotal={totals.subtotal}
            onClick={() => router.push('/cart')}
          />
        </div>
      )}
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>カートを空にしますか？</AlertDialogTitle>
          <AlertDialogDescription>
            カートには別のお店の商品が入っています。今の商品を外して、{pending?.menu.store.name}
            の商品を入れます。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) add(pending.menu, pending.item, true);
                setPending(undefined);
              }}
            >
              入れ替える
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
