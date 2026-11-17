'use client';

import {
  adminOrderQuerySchema,
  orderStatusSchema,
  type AdminOrder,
  type AdminOrderQuery,
} from '@repo/contract';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { StatusLabel } from '@/components/ui/status-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
      {id ? (
        <>
          <Link href="/admin/orders" className="text-brand underline">
            ← 注文一覧へ戻る
          </Link>
          {order && <h1 className="text-heading-l break-all">注文 {order.id}</h1>}
        </>
      ) : (
        <>
          <h1 className="text-heading-l">注文一覧</h1>
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
        </>
      )}
      <p className="text-body-s text-secondary">返金はテスト用の設定でのみ実行できます。</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!id && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          再読み込み
        </Button>
      )}
      {loading ? (
        <p role="status">注文を読み込んでいます…</p>
      ) : id && order ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-label-m break-all">{order.storeName}</p>
              <div className="flex flex-wrap items-center gap-3">
                <StatusLabel status={order.status} />
                <span className="text-body-s text-secondary">
                  {paymentLabels[order.paymentStatus]}
                </span>
                <time className="text-body-s text-secondary" dateTime={order.createdAt}>
                  {new Date(order.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                </time>
              </div>
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setRevision((value) => value + 1)}
            >
              再読み込み
            </Button>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div className="min-w-0 space-y-6">
              <section className="border-default space-y-4 rounded-lg border p-5">
                <h3 className="text-heading-m">注文内容</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead className="text-right">単価</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">小計</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.menuItemId}>
                        <TableCell className="whitespace-normal">{item.name}</TableCell>
                        <TableCell className="text-right">{yen(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {yen(item.unitPrice * item.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <dl className="ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-body-s">
                  <dt>商品小計</dt>
                  <dd className="text-right">{yen(order.subtotal)}</dd>
                  <dt>配達料</dt>
                  <dd className="text-right">{yen(order.deliveryFee)}</dd>
                  <dt className="text-label-m border-default border-t pt-3">合計</dt>
                  <dd className="text-label-m border-default border-t pt-3 text-right">
                    {yen(order.total)}
                  </dd>
                </dl>
              </section>
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">状態の履歴</h3>
                {order.statusHistory.length ? (
                  <ol className="space-y-3">
                    {order.statusHistory.map((event, index) => (
                      <li
                        key={`${event.createdAt}-${index}`}
                        className="flex flex-wrap gap-x-4 gap-y-1"
                      >
                        <time className="text-body-s text-secondary" dateTime={event.createdAt}>
                          {new Date(event.createdAt).toLocaleString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                          })}
                        </time>
                        <span>{statusLabels[event.status]}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-body-s text-secondary">状態履歴はありません。</p>
                )}
              </section>
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">運営の操作履歴</h3>
                <p className="text-body-s text-secondary">
                  導入前の状態変更日時は記録されていません。
                </p>
                {order.history.length ? (
                  <ol className="space-y-3">
                    {order.history.map((event, index) => (
                      <li
                        key={`${event.createdAt}-${index}`}
                        className="flex flex-wrap gap-x-4 gap-y-1"
                      >
                        <time className="text-body-s text-secondary" dateTime={event.createdAt}>
                          {new Date(event.createdAt).toLocaleString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                          })}
                        </time>
                        <span>
                          {statusLabels[event.previousStatus]} ・{' '}
                          {event.action === 'cancel' ? 'キャンセル・返金開始' : '担当解除'}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-body-s text-secondary">運営の操作履歴はありません。</p>
                )}
              </section>
            </div>
            <aside className="min-w-0 space-y-6">
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">お届け先</h3>
                <p>{order.address}</p>
                {order.building && <p>{order.building}</p>}
                <p className="text-body-s text-secondary">
                  {order.fulfillment === 'leave_at_door' ? '置き配' : '手渡し'}
                  {order.dropoffLocation &&
                    ` ・ ${
                      {
                        front_door: '玄関前',
                        delivery_box: '宅配ボックス',
                        other: 'その他',
                      }[order.dropoffLocation]
                    }`}
                </p>
              </section>
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">店舗</h3>
                <p>{order.storeName}</p>
              </section>
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">担当配達員</h3>
                <p className="break-all">{order.courierId ?? '未割当'}</p>
              </section>
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">決済</h3>
                <p>{paymentLabels[order.paymentStatus]}</p>
                {order.cancellationReason && (
                  <p>
                    キャンセル理由:{' '}
                    {order.cancellationReason === 'admin'
                      ? '運営によるキャンセル'
                      : order.cancellationReason}
                  </p>
                )}
              </section>
              <section className="border-default space-y-3 rounded-lg border p-5">
                <h3 className="text-heading-m">操作</h3>
                {(['preparing', 'ready', 'delivering'].includes(order.status) ||
                  (order.cancellationReason === 'admin' && order.paymentStatus !== 'refunded')) && (
                  <Button
                    className="w-full"
                    disabled={busy || !!error}
                    variant="secondary"
                    onClick={() => setConfirm('cancel')}
                  >
                    {order.status === 'canceled' ? '返金を再確認' : 'キャンセルと返金'}
                  </Button>
                )}
                {order.courierId && !['delivered', 'canceled'].includes(order.status) && (
                  <Button
                    className="w-full"
                    disabled={busy || !!error}
                    variant="secondary"
                    onClick={() => setConfirm('unassign')}
                  >
                    担当の配達員を外す
                  </Button>
                )}
                {!order.courierId &&
                  !['preparing', 'ready', 'delivering'].includes(order.status) && (
                    <p className="text-body-s text-secondary">実行できる操作はありません。</p>
                  )}
              </section>
            </aside>
          </div>
          {busy && <p role="status">結果を確認しています…</p>}
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
        </div>
      ) : (
        <>
          <p>新しい順に最大100件表示します。検索条件で絞り込めます。</p>
          {!rows.length && <p>該当する注文はありません。</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>注文日時</TableHead>
                <TableHead>注文番号</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">合計</TableHead>
                <TableHead>担当配達員</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </TableCell>
                    <TableCell>
                      <Link className="text-brand underline" href={`/admin/orders/${row.id}`}>
                        {row.id}
                      </Link>
                    </TableCell>
                    <TableCell>{row.storeName}</TableCell>
                    <TableCell>
                      <StatusLabel status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">{yen(row.total)}</TableCell>
                    <TableCell className="max-w-48 truncate">{row.courierId ?? '未割当'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="text-secondary text-center">
                    該当する注文はありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}
    </>
  );
}
