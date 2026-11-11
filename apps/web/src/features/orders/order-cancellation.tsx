'use client';

import { useRef, useState } from 'react';
import type { OrderDetail } from '@repo/contract';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  cancelOrder,
  OrderConflictError,
  OrderAccessError,
  OrderNotFoundError,
  OrderReadError,
} from './requests';

export function OrderCancellation({
  order,
  refresh,
  unavailable,
}: {
  order: OrderDetail;
  refresh: () => Promise<void>;
  unavailable: boolean;
}) {
  const key = `order-cancellation:${order.id}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(key) === 'pending';
    } catch {
      return false;
    }
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const locked = useRef(false);
  function remember(value: boolean) {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(key, 'pending');
      else sessionStorage.removeItem(key);
    } catch {
      /* Keep the in-memory retry path when storage is unavailable. */
    }
  }
  async function submit() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setOpen(false);
    setMessage('');
    remember(true);
    try {
      await cancelOrder(order.id);
      remember(false);
      setMessage('注文と決済の取消を確認しました。');
    } catch (cause) {
      setMessage(
        cause instanceof OrderReadError
          ? cause.message
          : '取消結果を確認できません。注文状況を確認し、決済取消を再確認してください。',
      );
      if (
        cause instanceof OrderConflictError ||
        cause instanceof OrderAccessError ||
        cause instanceof OrderNotFoundError
      )
        remember(false);
    } finally {
      await refresh();
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3" aria-busy={busy}>
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">取消結果と最新の注文状況を確認しています…</p>}
      {uncertain && order.status === 'canceled' && (
        <>
          <p role="alert">注文はキャンセルされていますが、決済取消の確認が必要です。</p>
          <Button variant="secondary" disabled={busy || unavailable} onClick={() => void submit()}>
            決済取消を再確認
          </Button>
        </>
      )}
      {order.status === 'pending' && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" disabled={busy || unavailable}>
              取り消す
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>注文を取り消しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              店舗が受け付ける前の注文を取り消します。取り消した注文は元に戻せません。
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>取り消さない</AlertDialogCancel>
              <AlertDialogAction variant="danger" disabled={busy} onClick={() => void submit()}>
                注文を取り消す
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
