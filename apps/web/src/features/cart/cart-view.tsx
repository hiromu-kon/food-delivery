'use client';

import Link from 'next/link';
import { ShoppingBagIcon, StoreIcon } from 'lucide-react';
import { calculateCartTotals, checkCartOrderability, formatYen } from '@repo/domain';
import { FoodPhoto } from '@/components/ui/food-photo';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useCart } from './cart-provider';

export function CartView() {
  const { ready, cart, notice, actions } = useCart();
  const totals = calculateCartTotals(cart?.items ?? []);
  const orderability = checkCartOrderability(
    cart?.items ?? [],
    cart?.store.minimumOrderAmount ?? 0,
  );
  return (
    <main className="mx-auto flex w-full max-w-200 flex-1 flex-col gap-5 px-4 pt-4 md:px-6">
      <h1 className="text-heading-m">カート</h1>
      {notice && (
        <NoticeBanner tone="warning" role="alert">
          {notice}
        </NoticeBanner>
      )}
      {!ready ? (
        <p role="status">カートを確認しています…</p>
      ) : !cart ? (
        <EmptyState
          icon={<ShoppingBagIcon aria-hidden />}
          title="カートは空です"
          description="お店のメニューから商品を選んでください。"
          action={
            <Button asChild>
              <Link href="/">お店を探す</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-label-l flex items-start gap-2 break-words">
              <StoreIcon className="size-5 shrink-0" aria-hidden />
              {cart.store.name}
            </h2>
            <Link
              className="text-label-m text-brand inline-flex min-h-11 items-center underline"
              href={`/stores/${cart.store.id}/menu`}
            >
              メニューに戻る
            </Link>
          </div>
          <ul>
            {cart.items.map((item) => (
              <li
                key={item.productId}
                className="border-default flex flex-wrap items-center justify-between gap-4 border-b py-4"
              >
                <FoodPhoto
                  photoUrl={item.photoUrl ?? undefined}
                  alt={`${item.name}の写真`}
                  className="size-16 shrink-0"
                />
                <div className="min-w-0 flex-1 basis-24 space-y-1">
                  <h3 className="text-body-m break-words">{item.name}</h3>
                  <p className="text-body-s text-secondary">
                    {formatYen(item.unitPrice)} × {item.quantity}
                  </p>
                  <p className="text-label-m">{formatYen(item.unitPrice * item.quantity)}</p>
                </div>
                <QuantityStepper
                  itemName={item.name}
                  quantity={item.quantity}
                  onQuantityChange={(quantity) => actions.setQuantity(item.productId, quantity)}
                  onRemove={() => actions.setQuantity(item.productId, 0)}
                />
              </li>
            ))}
          </ul>
          {totals.status === 'ok' && (
            <dl className="text-body-s space-y-2" aria-live="polite">
              <div className="flex justify-between gap-4">
                <dt>小計</dt>
                <dd>{formatYen(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>配達料</dt>
                <dd>{formatYen(totals.deliveryFee)}</dd>
              </div>
              <div className="text-label-l border-default flex justify-between gap-4 border-t pt-4">
                <dt>合計（税込）</dt>
                <dd>{formatYen(totals.total)}</dd>
              </div>
            </dl>
          )}
          {orderability.status === 'below-minimum' && (
            <NoticeBanner tone="warning" role="status">
              最低注文金額 {formatYen(cart.store.minimumOrderAmount)} まで、あと{' '}
              {formatYen(orderability.shortfall)} です。
            </NoticeBanner>
          )}
          {orderability.status === 'orderable' && (
            <p role="status" className="text-body-s text-secondary">
              最低注文金額を満たしています。
            </p>
          )}
          <div className="bg-base sticky bottom-0 z-20 mt-auto space-y-2 py-3">
            <Button disabled className="w-full">
              注文手続きに進む
            </Button>
            <p className="text-body-s text-secondary">注文・お支払いは現在準備中です。</p>
          </div>
        </>
      )}
    </main>
  );
}
