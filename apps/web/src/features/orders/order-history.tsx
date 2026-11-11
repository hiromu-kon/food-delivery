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
      {error && <ResourceFeedback error={error} retry={() => void retry()} />}
      {data &&
        (data.length ? (
          <ul className="divide-y">
            {data.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className="hover:bg-subtle flex min-h-22 items-center justify-between gap-3 py-4 outline-offset-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-label-l break-words">{order.storeName}</p>
                    <div className="text-body-s text-secondary flex flex-wrap gap-x-3 gap-y-1">
                      <time dateTime={order.createdAt}>{orderDate(order.createdAt)}</time>
                      <span>{formatYen(order.total)}</span>
                    </div>
                  </div>
                  <StatusLabel status={order.status} />
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
