'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AcceptanceError, loadAcceptance, saveAcceptance } from './requests';

type Store = Awaited<ReturnType<typeof loadAcceptance>>;

export function AcceptanceSettings() {
  const [store, setStore] = useState<Store | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [target, setTarget] = useState<boolean | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);

  function fail(cause: unknown, updating: boolean) {
    setStore(null);
    setTarget(null);
    if (cause instanceof AcceptanceError && (cause.status === 401 || cause.status === 403)) {
      window.location.replace(cause.status === 401 ? '/store/login' : '/store/login?reason=denied');
    }
    setError(
      updating
        ? '切替の結果を確認できません。現在の状態を再取得してください。'
        : '受付状態を取得できません。接続を確認して再取得してください。',
    );
  }

  async function refresh() {
    if (locked.current) return;
    locked.current = true;
    const request = ++generation.current;
    setBusy(true);
    setStore(null);
    setError('');
    setMessage('');
    try {
      const result = await loadAcceptance();
      if (request === generation.current) setStore(result);
    } catch (cause) {
      if (request === generation.current) fail(cause, false);
    } finally {
      if (request === generation.current) {
        setBusy(false);
        locked.current = false;
      }
    }
  }

  useEffect(() => {
    let active = true;
    void loadAcceptance().then(
      (result) => {
        if (active) {
          setStore(result);
          setBusy(false);
        }
      },
      (cause: unknown) => {
        if (active) {
          fail(cause, false);
          setBusy(false);
        }
      },
    );
    const requests = generation;
    return () => {
      active = false;
      ++requests.current;
    };
  }, []);

  async function save() {
    if (locked.current || !store || target === null) return;
    locked.current = true;
    const request = ++generation.current;
    setBusy(true);
    setTarget(null);
    setMessage('');
    try {
      const result = await saveAcceptance(store.id, target);
      if (request === generation.current) {
        setStore({ ...store, ...result });
        setMessage(result.isAcceptingOrders ? '受付を再開しました。' : '受付を停止しました。');
      }
    } catch (cause) {
      if (request === generation.current) fail(cause, true);
    } finally {
      if (request === generation.current) {
        setBusy(false);
        locked.current = false;
      }
    }
  }

  return (
    <section className="w-full max-w-180 space-y-6" aria-labelledby="settings-title">
      <h1 id="settings-title" className="text-heading-l">
        店舗の設定
      </h1>
      {store && <p className="text-heading-m wrap-anywhere">{store.name}</p>}
      <div className="border-default space-y-5 rounded-lg border p-6" aria-busy={busy}>
        <h2 className="text-heading-m">注文の受付</h2>
        <p className="text-body-m text-secondary">
          停止中も店舗とメニューは公開されます。新しい注文の受付を再開するには、受付中に切り替えてください。
        </p>
        {store && (
          <div className="flex items-center justify-between gap-4">
            <p id="acceptance-state" className="text-heading-m" role="status">
              {store.isAcceptingOrders ? '受付中' : '停止中'}
            </p>
            <Switch
              aria-label="注文を受け付ける"
              aria-describedby="acceptance-state"
              checked={store.isAcceptingOrders}
              disabled={busy}
              onCheckedChange={setTarget}
            />
          </div>
        )}
        {busy && (
          <p role="status">{store ? '受付状態を更新しています…' : '受付状態を確認しています…'}</p>
        )}
        {error && (
          <NoticeBanner tone="danger" role="alert">
            {error}
          </NoticeBanner>
        )}
        {message && (
          <p role="status" className="text-body-m">
            {message}
          </p>
        )}
        {!busy && (
          <Button variant="secondary" onClick={() => void refresh()}>
            現在の状態を再取得
          </Button>
        )}
      </div>
      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{target ? '受付を再開する' : '受付を停止する'}</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? '新しい注文を受け付けます。'
              : '新しい注文の受付を停止します。店舗とメニューは引き続き公開されます。'}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save()}>
              {target ? '受付を再開する' : '受付を停止する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
