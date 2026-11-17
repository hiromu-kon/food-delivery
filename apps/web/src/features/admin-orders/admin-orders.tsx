'use client';

import {
  adminOrderQuerySchema,
  orderStatusSchema,
  type AdminOrder,
  type AdminOrderQuery,
} from '@repo/contract';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getAdminOrder, listAdminOrders, updateAdminOrder } from './requests';

const statusLabels = {
  pending: '受付待ち',
  preparing: '調理中',
  ready: '準備完了',
  delivering: '配達中',
  delivered: '配達完了',
  canceled: 'キャンセル',
};
const paymentLabels = {
  authorized: '仮売上',
  captured: '売上確定',
  voided: '仮売上取消済み',
  reconciling: '決済確認中',
  refunded: '全額返金済み',
};
const yen = (amount: number) => `${amount.toLocaleString('ja-JP')}円`;

export function AdminOrders({ id }: { id?: string }) {
  const [query, setQuery] = useState<AdminOrderQuery>({});
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirm, setConfirm] = useState<'cancel' | 'unassign' | null>(null);
  const generation = useRef(0);
  const mutation = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const current = ++generation.current;
    let first = true;
    async function load() {
      if (first) {
        setLoading(true);
        first = false;
      }
      if (locked.current) {
        timer = setTimeout(() => void load(), 5000);
        return;
      }
      controller = new AbortController();
      try {
        const result = id
          ? [await getAdminOrder(id, controller.signal)]
          : await listAdminOrders(query, controller.signal);
        if (active && current === generation.current) {
          setRows(result);
          setError('');
          setLoading(false);
        }
      } catch (cause) {
        if (active && current === generation.current) {
          setError(cause instanceof Error ? cause.message : '読み込めませんでした');
          setLoading(false);
        }
      } finally {
        if (active) timer = setTimeout(() => void load(), 5000);
      }
    }
    void load();
    return () => {
      active = false;
      controller?.abort();
      mutation.current?.abort();
      clearTimeout(timer);
    };
  }, [id, query, revision]);

  async function submit(action: 'cancel' | 'unassign') {
    if (!id || locked.current) return;
    locked.current = true;
    setConfirm(null);
    setBusy(true);
    setMessage('');
    const current = ++generation.current;
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const order = await updateAdminOrder(id, action, controller.signal);
      if (!controller.signal.aborted && current === generation.current) {
        setRows([order]);
        setMessage(action === 'cancel' ? '全額返金を確認しました。' : '担当の配達員を外しました。');
      }
    } catch (cause) {
      if (!controller.signal.aborted && current === generation.current)
        setMessage(
          cause instanceof Error ? cause.message : '結果が未確認です。再読み込みしてください。',
        );
    } finally {
      locked.current = false;
      if (!controller.signal.aborted) {
        setBusy(false);
        setRevision((value) => value + 1);
      }
    }
  }
  const order = rows[0];
  return (
    <>
      <h1 className="text-heading-l">{id ? '注文の詳細' : '注文一覧'}</h1>
      {id ? (
        <Link href="/admin/orders" className="text-brand underline">
          注文一覧へ戻る
        </Link>
      ) : (
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const parsed = adminOrderQuerySchema.safeParse(
              Object.fromEntries([...data.entries()].filter(([, value]) => value !== '')),
            );
            if (!parsed.success) {
              setError('注文ID・店舗IDはUUID形式、日付は正しい日付で入力してください。');
              return;
            }
            setQuery(parsed.data);
          }}
        >
          <label className="space-y-2">
            状態
            <select name="status" className="border-default block h-12 rounded-md border px-3">
              <option value="">すべて</option>
              {orderStatusSchema.options.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            店舗ID
            <Input name="storeId" placeholder="店舗のUUID" />
          </label>
          <label>
            日付（日本時間）
            <Input name="date" type="date" />
          </label>
          <label>
            注文ID
            <Input name="id" placeholder="注文のUUID" />
          </label>
          <Button type="submit">検索</Button>
        </form>
      )}
      <p className="text-body-s text-secondary">返金はテスト用の設定でのみ実行できます。</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Button variant="secondary" disabled={busy} onClick={() => setRevision((value) => value + 1)}>
        再読み込み
      </Button>
      {loading ? (
        <p role="status">注文を読み込んでいます…</p>
      ) : id && order ? (
        <>
          <section className="border-default space-y-3 rounded-lg border p-5">
            <h2 className="text-heading-m">{order.storeName}</h2>
            <p className="break-all">注文ID: {order.id}</p>
            <p>
              {statusLabels[order.status]} ・ {paymentLabels[order.paymentStatus]}
            </p>
            <p>{new Date(order.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
            <p>
              お届け先: {order.address} {order.building}
            </p>
            <ul>
              {order.items.map((item) => (
                <li key={item.menuItemId}>
                  {item.name} × {item.quantity} ・ {yen(item.unitPrice * item.quantity)}
                </li>
              ))}
            </ul>
            <p>
              商品小計 {yen(order.subtotal)} / 配達料 {yen(order.deliveryFee)}
            </p>
            <p className="text-heading-m">合計 {yen(order.total)}</p>
            <p>担当配達員: {order.courierId ?? '未割当'}</p>
            {order.cancellationReason && (
              <p>
                キャンセル理由:{' '}
                {order.cancellationReason === 'admin'
                  ? '運営によるキャンセル'
                  : order.cancellationReason}
              </p>
            )}
          </section>
          <div className="flex flex-wrap gap-3">
            {(['preparing', 'ready', 'delivering'].includes(order.status) ||
              (order.cancellationReason === 'admin' && order.paymentStatus !== 'refunded')) && (
              <Button
                disabled={busy || !!error}
                variant="secondary"
                onClick={() => setConfirm('cancel')}
              >
                {order.status === 'canceled' ? '返金を再確認' : 'キャンセルと返金'}
              </Button>
            )}
            {order.courierId && !['delivered', 'canceled'].includes(order.status) && (
              <Button
                disabled={busy || !!error}
                variant="secondary"
                onClick={() => setConfirm('unassign')}
              >
                担当の配達員を外す
              </Button>
            )}
          </div>
          {busy && <p role="status">結果を確認しています…</p>}
          <section className="space-y-2">
            <h2 className="text-heading-m">状態の履歴</h2>
            <ul>
              {order.statusHistory.map((event, index) => (
                <li key={index}>
                  {new Date(event.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ・{' '}
                  {statusLabels[event.status]}
                </li>
              ))}
            </ul>
            <h2 className="text-heading-m">運営の操作履歴</h2>
            <p className="text-body-s">導入前の状態変更日時は記録されていません。</p>
            <ul>
              {order.history.map((event, index) => (
                <li key={index}>
                  {new Date(event.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ・{' '}
                  {statusLabels[event.previousStatus]} ・{' '}
                  {event.action === 'cancel' ? 'キャンセル・返金開始' : '担当解除'}
                </li>
              ))}
            </ul>
          </section>
          <AlertDialog
            open={confirm !== null}
            onOpenChange={(open) => {
              if (!open) setConfirm(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogTitle>
                {confirm === 'cancel' ? 'キャンセルと返金の確認' : '担当解除の確認'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirm === 'cancel'
                  ? `注文をキャンセルし、配達料を含む${yen(order.total)}を全額返金します。元に戻せません。`
                  : '担当の配達員を外します。注文の状態は変わりません。'}
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>戻る</AlertDialogCancel>
                <AlertDialogAction
                  variant="danger"
                  onClick={() => {
                    if (confirm) void submit(confirm);
                  }}
                >
                  実行する
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <p>新しい順に最大100件表示します。検索条件で絞り込めます。</p>
          {!rows.length && <p>該当する注文はありません。</p>}
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="border-default rounded-lg border p-4">
                <Link className="text-brand underline" href={`/admin/orders/${row.id}`}>
                  {row.storeName} ・ {statusLabels[row.status]} ・ {yen(row.total)}
                </Link>
                <p className="text-body-s break-all">
                  {row.id} ・{' '}
                  {new Date(row.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
