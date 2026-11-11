'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { formatYen } from '@repo/domain';
import { OrderSteps } from '@/components/ui/order-steps';
import { StatusLabel } from '@/components/ui/status-label';
import { OrderCancellation } from './order-cancellation';
import { getOrder } from './requests';
import { useOrdersResource } from './use-orders-resource';
import { ResourceFeedback, orderDate } from './resource-feedback';

export function OrderDetail({ orderId }: { orderId: string }) {
  const load = useCallback((signal: AbortSignal) => getOrder(orderId, signal), [orderId]);
  const { data: order, loading, error, retry } = useOrdersResource(load, true);
  return (
    <div className="space-y-5">
      {loading && <p role="status">注文状況を読み込んでいます…</p>}
      {error && <ResourceFeedback error={error} retry={() => void retry()} />}
      {order && (
        <>
          <section
            className="bg-brand-subtle space-y-3 rounded-lg px-4 py-5"
            aria-label="現在の注文状況"
          >
            <div role="status">
              <StatusLabel status={order.status} />
            </div>
            <h2 className="text-heading-l">
              {
                {
                  pending: 'お店の受付を待っています',
                  preparing: 'お店で調理しています',
                  ready: 'お料理の準備ができました',
                  delivering: 'お届け先に向かっています',
                  delivered: 'お届けしました',
                  canceled: '注文はキャンセルされました',
                }[order.status]
              }
            </h2>
            <OrderSteps status={order.status} />
            <p className="text-body-s text-secondary">
              この画面を開いている間、15秒ごとに更新します。
            </p>
          </section>
          <section className="space-y-3 border-t pt-5" aria-labelledby="order-items-heading">
            <h2 id="order-items-heading" className="text-heading-m">
              注文内容
            </h2>
            <p className="text-label-l break-words">{order.storeName}</p>
            <time className="text-body-s text-secondary" dateTime={order.createdAt}>
              {orderDate(order.createdAt)}
            </time>
            <p className="text-body-s break-all">注文番号：{order.id}</p>
            <dl className="space-y-3">
              {order.items.map((item, index) => (
                <div key={`${item.menuItemId}-${index}`} className="flex justify-between gap-4">
                  <dt className="min-w-0 break-words">
                    {item.name} × {item.quantity}
                  </dt>
                  <dd className="shrink-0">{formatYen(item.unitPrice * item.quantity)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <dt>小計</dt>
                <dd>{formatYen(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>配達料</dt>
                <dd>{formatYen(order.deliveryFee)}</dd>
              </div>
              <div className="text-label-l flex justify-between gap-4 border-t pt-3">
                <dt>合計（税込）</dt>
                <dd>{formatYen(order.total)}</dd>
              </div>
            </dl>
          </section>
          <section className="space-y-1" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-label-l">
              お届け先
            </h2>
            <p className="text-body-s text-secondary break-words">
              {[order.address, order.building].filter(Boolean).join(' ')}
            </p>
            <p className="text-body-s text-secondary">
              {order.fulfillment === 'hand_delivery'
                ? '手渡し'
                : `置き配（${order.dropoffLocation ? { front_door: '玄関前', delivery_box: '宅配ボックス', other: 'その他' }[order.dropoffLocation] : '置き場所未指定'}）`}
            </p>
          </section>
          <OrderCancellation key={order.id} order={order} refresh={retry} unavailable={!!error} />
          {order.status === 'delivered' && order.fulfillment === 'leave_at_door' && (
            <section className="space-y-3 border-t pt-5" aria-labelledby="delivery-photo-heading">
              <h2 id="delivery-photo-heading" className="text-heading-m">
                置き配の写真
              </h2>
              {order.deliveryPhotoUrl ? (
                <DeliveryPhoto key={order.deliveryPhotoUrl} url={order.deliveryPhotoUrl} />
              ) : (
                <p className="text-body-s text-secondary">置き配の写真はまだありません。</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DeliveryPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p role="status">写真を読み込めませんでした。</p>
  ) : (
    <Image
      unoptimized
      width={960}
      height={720}
      src={url}
      alt="配達員が撮影した、商品を置いた場所"
      className="h-auto w-full rounded-md"
      onError={() => setFailed(true)}
    />
  );
}
