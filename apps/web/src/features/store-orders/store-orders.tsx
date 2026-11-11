'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { StoreOrderDetail, StoreOrderSummary } from '@repo/contract';
import { formatYen } from '@repo/domain';
import {
  actOnStoreOrder,
  getStoreOrder,
  getStoreOrders,
  StoreOrderError,
} from '@/api/store-orders';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { StatusLabel } from '@/components/ui/status-label';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { useStoreOrders } from './use-store-orders';

export function remainingTime(deadline: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  return seconds === 0
    ? '受付期限を過ぎました'
    : `残り ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function RemainingTime({ order }: { order: StoreOrderSummary }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return (
    <p className="text-label-l text-danger">
      {now === null ? '受付期限を確認中…' : remainingTime(order.acceptanceDeadline, now)}
    </p>
  );
}
function Feedback({ error, refresh }: { error: string; refresh: () => Promise<void> }) {
  return (
    <div className="space-y-3">
      <NoticeBanner tone="danger" role="alert">
        {error}
      </NoticeBanner>
      <Button variant="secondary" onClick={() => void refresh()}>
        再読み込み
      </Button>
    </div>
  );
}
export function StoreOrders() {
  const { data: orders, error, loading, refresh } = useStoreOrders(getStoreOrders);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-l">注文一覧</h1>
        <p className="text-body-s text-secondary mt-2">
          5秒ごとに更新します。受付待ちの注文を確認してください。
        </p>
      </div>
      {error && <Feedback error={error} refresh={refresh} />}
      {loading && <p role="status">注文を読み込んでいます…</p>}
      {orders && (
        <>
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border-2 border-brand bg-brand-subtle p-5"
          >
            <p className="text-heading-m">
              受付待ち {orders.filter((order) => order.status === 'pending').length}件
            </p>
            <p className="mt-2">新しい注文は受付待ちに表示されます。</p>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            {(['pending', 'preparing', 'ready'] as const).map((status) => (
              <section key={status} className="min-w-0 space-y-4">
                <h2 className="text-heading-m">
                  {{ pending: '受付待ち', preparing: '調理中', ready: '準備完了' }[status]}{' '}
                  <span className="text-secondary">
                    {orders.filter((order) => order.status === status).length}件
                  </span>
                </h2>
                {orders
                  .filter((order) => order.status === status)
                  .map((order) => (
                    <Link
                      key={order.id}
                      href={`/store/orders/${order.id}`}
                      className={`block space-y-3 rounded-lg border p-5 focus-visible:outline-2 ${status === 'pending' ? 'border-brand bg-brand-subtle' : 'border-default bg-base'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusLabel status={order.status} />
                        <strong>{formatYen(order.total)}</strong>
                      </div>
                      <p className="text-body-s break-all">注文番号 {order.id.slice(0, 8)}</p>
                      <time className="text-body-s" dateTime={order.createdAt}>
                        {new Date(order.createdAt).toLocaleString('ja-JP')}
                      </time>
                      {status === 'pending' && <RemainingTime order={order} />}
                      {order.paymentReconciling && (
                        <p className="text-danger">決済確認中・詳細から再確認してください</p>
                      )}
                      <p className="text-label-m text-brand">注文の詳細を見る →</p>
                    </Link>
                  ))}
                {!orders.some((order) => order.status === status) && (
                  <p className="text-secondary rounded-lg border border-dashed p-5">
                    注文はありません
                  </p>
                )}
              </section>
            ))}
          </div>
          {orders.some((order) => !['pending', 'preparing', 'ready'].includes(order.status)) && (
            <section className="space-y-3 border-t pt-6">
              <h2 className="text-heading-m">その他の注文</h2>
              {orders
                .filter((order) => !['pending', 'preparing', 'ready'].includes(order.status))
                .map((order) => (
                  <Link
                    key={order.id}
                    href={`/store/orders/${order.id}`}
                    className="flex flex-wrap items-center gap-4 rounded-lg border p-4"
                  >
                    <StatusLabel status={order.status} />
                    <span>{order.id.slice(0, 8)}</span>
                    <span>{formatYen(order.total)}</span>
                    {order.paymentReconciling && (
                      <span className="text-danger">決済取消の再確認が必要です</span>
                    )}
                  </Link>
                ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
export function StoreOrder({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => getStoreOrder(id, signal), [id]);
  const { data: order, error, loading, refresh } = useStoreOrders(load);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link href="/store/orders" className="text-brand">
        ← 注文一覧
      </Link>
      <h1 className="text-heading-l">注文の詳細</h1>
      {error && <Feedback error={error} refresh={refresh} />}
      {loading && <p role="status">注文を読み込んでいます…</p>}
      {order && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <StatusLabel status={order.status} />
            <span className="text-heading-m">{formatYen(order.total)}</span>
          </div>
          <p className="text-body-s break-all">注文番号 {order.id}</p>
          {order.status === 'pending' && <RemainingTime order={order} />}
          <OrderActions key={order.id} order={order} unavailable={!!error} refresh={refresh} />
          <section className="space-y-4 rounded-lg border p-6">
            <h2 className="text-heading-m">注文内容</h2>
            {order.items.map((item) => (
              <div key={item.menuItemId} className="flex justify-between gap-4">
                <span className="min-w-0 break-words">
                  {item.name} × {item.quantity}
                </span>
                <span>{formatYen(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-4">
              <span>商品小計</span>
              <span>{formatYen(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>配達料</span>
              <span>{formatYen(order.deliveryFee)}</span>
            </div>
            <div className="text-label-l flex justify-between">
              <span>合計（税込）</span>
              <span>{formatYen(order.total)}</span>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-heading-m">備考</h2>
            <p className="whitespace-pre-wrap break-words">
              {order.deliveryNote || '備考はありません'}
            </p>
            <h2 className="text-heading-m">担当の配達員</h2>
            <p>未割当</p>
          </section>
        </>
      )}
    </div>
  );
}
function OrderActions({
  order,
  unavailable,
  refresh,
}: {
  order: StoreOrderDetail;
  unavailable: boolean;
  refresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [error, setError] = useState('');
  const [retryAction, setRetryAction] = useState<'accept' | 'reject' | 'ready' | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const first = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      controller.current?.abort();
    };
  }, []);
  async function act(action: 'accept' | 'reject' | 'ready') {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setError('');
    setRetryAction(null);
    try {
      await actOnStoreOrder(order.id, action, request.signal);
      if (request.signal.aborted) return;
      setConfirmReject(false);
      await refresh();
    } catch (cause) {
      if (request.signal.aborted) return;
      setError(
        cause instanceof StoreOrderError
          ? cause.message
          : '結果を確認できません。同じ操作で再確認してください。',
      );
      if (!(cause instanceof StoreOrderError && cause.stop)) {
        if (!(cause instanceof StoreOrderError) || cause.retrySame) setRetryAction(action);
        await refresh();
      }
    } finally {
      if (!request.signal.aborted) {
        controller.current = null;
        setPending(false);
      }
    }
  }
  const canRetry =
    retryAction &&
    (retryAction === 'ready'
      ? order.status === 'preparing'
      : retryAction === 'accept'
        ? order.status === 'pending'
        : order.status === 'pending' || (order.status === 'canceled' && order.paymentReconciling));
  const expired = now === null || now >= Date.parse(order.acceptanceDeadline);
  return (
    <section className="space-y-4" aria-label="注文の操作">
      {order.paymentReconciling && (
        <NoticeBanner tone="danger">
          決済の結果を確認中です。{order.status === 'pending' ? '受付' : '取消'}
          を再確認してください。
        </NoticeBanner>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {retryAction && canRetry && (
        <Button
          variant="secondary"
          disabled={pending || unavailable}
          onClick={() => void act(retryAction)}
        >
          同じ操作を再確認
        </Button>
      )}
      {order.status === 'pending' && (
        <div className="flex flex-wrap gap-3">
          <Button
            loading={pending}
            disabled={unavailable || (expired && !order.paymentReconciling)}
            onClick={() => void act('accept')}
          >
            {order.paymentReconciling ? '受付の決済を再確認' : '受け付ける'}
          </Button>
          <Button
            variant="danger"
            disabled={pending || unavailable || order.paymentReconciling}
            onClick={() => setConfirmReject(true)}
          >
            断る
          </Button>
        </div>
      )}
      {order.status === 'pending' && (
        <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
          <AlertDialogContent>
            <AlertDialogTitle>注文を断る確認</AlertDialogTitle>
            <AlertDialogDescription>
              この注文を断りますか？仮売上が取り消されます。
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>戻る</AlertDialogCancel>
              <AlertDialogAction
                variant="danger"
                disabled={pending || unavailable || order.paymentReconciling}
                onClick={() => void act('reject')}
              >
                注文を断る
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {order.status === 'preparing' && (
        <Button loading={pending} disabled={unavailable} onClick={() => void act('ready')}>
          準備完了にする
        </Button>
      )}
      {order.status === 'canceled' && order.paymentReconciling && (
        <Button loading={pending} disabled={unavailable} onClick={() => void act('reject')}>
          決済取消を再確認
        </Button>
      )}
    </section>
  );
}
