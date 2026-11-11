'use client';

import Link from 'next/link';
import { ReceiptTextIcon } from 'lucide-react';
import { formatYen } from '@repo/domain';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusLabel } from '@/components/ui/status-label';
import { getOrders } from './requests';
import { useOrdersResource } from './use-orders-resource';
import { ResourceFeedback, orderDate } from './resource-feedback';

export function OrderHistory() {
  const { data, loading, error, retry } = useOrdersResource(getOrders);
  return (
    <div className="space-y-4">
      {loading && <p role="status">注文履歴を読み込んでいます…</p>}
      {error && <ResourceFeedback error={error} retry={retry} />}
      {data &&
        (data.length ? (
          <ul className="divide-y">
            {data.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className="hover:bg-subtle block space-y-3 py-4 outline-offset-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time className="text-body-s text-secondary" dateTime={order.createdAt}>
                      {orderDate(order.createdAt)}
                    </time>
                    <StatusLabel status={order.status} />
                  </div>
                  <p className="text-label-l break-words">{order.storeName}</p>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{formatYen(order.total)}</span>
                    <span className="text-brand underline">注文状況を見る</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ReceiptTextIcon aria-hidden />}
            title="注文履歴はまだありません"
            description="注文すると、ここで注文状況を確認できます。"
            action={
              <Button asChild>
                <Link href="/">お店を探す</Link>
              </Button>
            }
          />
        ))}
    </div>
  );
}
