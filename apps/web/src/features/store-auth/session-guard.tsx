'use client';

import { storeMeResponseSchema, type StoreContext } from '@repo/contract';
import { ReceiptTextIcon, StoreIcon, UtensilsCrossedIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { SideNav } from '@/components/ui/side-nav';
import { TopBar } from '@/components/ui/top-bar';
import { signOutStore, storeDeniedMessage } from './requests';

type View =
  | { kind: 'checking' | 'failed' | 'denied' | 'logout-failed' }
  | { kind: 'allowed'; context: StoreContext; pathname: string };

export function StoreSessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const logoutLocked = useRef(false);
  const logoutIntent = useRef(false);

  async function logout() {
    if (logoutLocked.current) return;
    logoutIntent.current = true;
    logoutLocked.current = true;
    ++generation.current;
    setView({ kind: 'checking' });
    try {
      await signOutStore();
      window.location.replace('/store/login');
    } catch {
      setView({ kind: 'logout-failed' });
    } finally {
      logoutLocked.current = false;
    }
  }

  useEffect(() => {
    let active = true;
    async function verify() {
      if (logoutIntent.current) return;
      const request = ++generation.current;
      setView({ kind: 'checking' });
      const current = () => active && request === generation.current;
      try {
        const response: Response = await apiClient.store.me.$get({ query: {} });
        if (!current()) return;
        if (response.status === 401) {
          window.location.replace('/store/login');
          return;
        }
        if (response.status === 403) {
          logoutIntent.current = true;
          setView({ kind: 'denied' });
          window.location.replace('/store/login?reason=denied');
          return;
        }
        if (!response.ok) throw new Error('store verification failed');
        const context = storeMeResponseSchema.parse(await response.json());
        if (current()) setView({ kind: 'allowed', context, pathname });
      } catch {
        if (current()) setView({ kind: 'failed' });
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verify();
    };
    const onHidden = () => {
      if (logoutIntent.current) return;
      if (document.visibilityState === 'hidden') {
        ++generation.current;
        setView({ kind: 'checking' });
      } else void verify();
    };
    void verify();
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      active = false;
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [pathname, attempt]);

  if (view.kind !== 'allowed' || view.pathname !== pathname) {
    return (
      <main className="mx-auto w-full max-w-110 space-y-5 p-6">
        {view.kind === 'failed' ? (
          <>
            <NoticeBanner tone="danger" role="alert">
              店舗の利用状態を確認できませんでした。接続を確認して再試行してください。
            </NoticeBanner>
            <Button onClick={() => setAttempt((value) => value + 1)}>再試行</Button>
            <Button variant="secondary" onClick={() => void logout()}>
              ログアウトする
            </Button>
          </>
        ) : view.kind === 'logout-failed' ? (
          <>
            <NoticeBanner tone="danger" role="alert">
              ログアウトできませんでした。接続を確認して再試行してください。
            </NoticeBanner>
            <Button onClick={() => void logout()}>ログアウトを再試行</Button>
          </>
        ) : view.kind === 'denied' ? (
          <NoticeBanner tone="danger" role="alert">
            {storeDeniedMessage}
          </NoticeBanner>
        ) : (
          <p role="status">店舗の利用状態を確認しています…</p>
        )}
      </main>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col md:flex-row">
      <SideNav
        title="Food Delivery"
        subtitle={view.context.store.name}
        className="h-auto w-full md:sticky md:h-dvh md:w-60 [&_p]:wrap-anywhere"
        items={[
          { href: '/store/orders', label: '注文', icon: <ReceiptTextIcon /> },
          { href: '/store/menu', label: 'メニュー', icon: <UtensilsCrossedIcon /> },
          { href: '/store/settings', label: '店舗の設定', icon: <StoreIcon /> },
        ]}
        footer={
          <Button variant="ghost" className="w-full" onClick={() => void logout()}>
            ログアウト
          </Button>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          account={view.context.user.email}
          className="h-auto min-h-16 gap-3 px-5 py-3 [&_div]:min-w-0 [&_div]:wrap-anywhere"
        />
        <main className="flex min-w-0 flex-1 flex-col gap-6 px-5 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
