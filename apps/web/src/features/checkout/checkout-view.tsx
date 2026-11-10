'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addressSchema, type DeliveryAddress } from '@repo/contract';
import { calculateCartTotals, checkCartOrderability, formatYen } from '@repo/domain';
import { z } from 'zod';
import { apiClient } from '@/api/client';
import { env } from '@/env';
import { postOrder, OrderError, restoreAttempt, type OrderAttempt } from '@/api/orders';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { useCart } from '../cart/cart-provider';
import { deliverySchema, orderInput, type Delivery } from './checkout-state';
import { StripeCard, type CardPayment } from './stripe-card';

export function CheckoutView() {
  const { ready, cart, actions } = useCart();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [delivery, setDelivery] = useState<Delivery>({
    addressId: '',
    fulfillment: 'hand_delivery',
    deliveryNote: '',
  });
  const [payment, setPayment] = useState<CardPayment | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState<OrderAttempt | null>(null);
  const [restored, setRestored] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [orderId, setOrderId] = useState('');
  const busy = useRef(false);
  const storageKey = `${actions.key}:checkout`;
  const [reload, setReload] = useState(0);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = restoreAttempt(sessionStorage.getItem(storageKey));
        setAttempt(saved);
        if (saved) setDelivery({ ...saved.body, deliveryNote: saved.body.deliveryNote ?? '' });
      } catch {
        setStorageError(true);
      }
      setRestored(true);
    });
  }, [storageKey]);
  useEffect(() => {
    let active = true;
    async function load() {
      setAddressLoading(true);
      setAddressError('');
      try {
        const response = await apiClient.addresses.$get();
        if (!response.ok) throw new Error();
        const result = z.object({ addresses: z.array(addressSchema) }).parse(await response.json());
        if (!active) return;
        setAddresses(result.addresses);
        const first = result.addresses.find((item) => item.isDefault) ?? result.addresses[0];
        setDelivery((current) =>
          current.addressId || !first
            ? current
            : { ...current, addressId: first.id, deliveryNote: first.deliveryNote },
        );
      } catch {
        if (active) setAddressError('お届け先を取得できませんでした。再読み込みしてください。');
      } finally {
        if (active) setAddressLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reload]);
  const totals = calculateCartTotals(cart?.items ?? []);
  const orderable =
    !!cart &&
    checkCartOrderability(cart.items, cart.store.minimumOrderAmount).status === 'orderable';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !restored || storageError) return;
    setError('');
    let next = attempt;
    if (!next) {
      const parsed = deliverySchema.safeParse(delivery);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? '入力内容を確認してください。');
        return;
      }
      if (!cart || !orderable || !addresses.some((item) => item.id === parsed.data.addressId)) {
        setError('カートとお届け先を確認してください。');
        return;
      }
      if (!payment) {
        setError('カード情報をすべて入力してください。');
        return;
      }
    }
    busy.current = true;
    setPending(true);
    try {
      if (!next) {
        const paymentMethodId = await payment!.create();
        next = { key: crypto.randomUUID(), body: orderInput(cart!, delivery, paymentMethodId) };
        // Persist before sending: a reload or lost response must retry the same operation.
        sessionStorage.setItem(storageKey, JSON.stringify(next));
        setAttempt(next);
      }
      const order = await postOrder(env.NEXT_PUBLIC_API_URL, next);
      setOrderId(order.id);
      // Clear the submitted cart only; preserve a cart changed in another mounted view.
      const current = actions.getSnapshot().cart;
      if (
        current &&
        current.store.id === next.body.storeId &&
        JSON.stringify(
          current.items.map((item) => ({ menuItemId: item.productId, quantity: item.quantity })),
        ) === JSON.stringify(next.body.items)
      )
        actions.clear();
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Success is already confirmed. */
      }
      setAttempt(null);
    } catch (cause) {
      if (cause instanceof OrderError && !cause.retrySame) {
        try {
          sessionStorage.removeItem(storageKey);
          setAttempt(null);
        } catch {
          setStorageError(true);
        }
      }
      setError(
        cause instanceof Error ? cause.message : '注文できませんでした。もう一度お試しください。',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (orderId)
    return (
      <section className="space-y-4" aria-live="polite">
        <h2 className="text-heading-m">注文を受け付けました</h2>
        <p>お店の受付をお待ちください。</p>
        <p className="text-body-s break-all">注文番号：{orderId}</p>
        <Button asChild>
          <Link href="/">お店を探す</Link>
        </Button>
      </section>
    );
  if (!ready || !restored) return <p role="status">注文内容を確認しています…</p>;
  if (!cart && !attempt)
    return (
      <div className="space-y-4">
        <p>カートは空です。</p>
        <Button asChild>
          <Link href="/">お店を探す</Link>
        </Button>
      </div>
    );
  const selectedAddress = addresses.find((item) => item.id === delivery.addressId);
  const locked = pending || !!attempt;
  const summaryMatches =
    !attempt ||
    (cart?.store.id === attempt.body.storeId &&
      JSON.stringify(
        cart.items.map((item) => ({ menuItemId: item.productId, quantity: item.quantity })),
      ) === JSON.stringify(attempt.body.items));
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      {error && (
        <NoticeBanner tone="danger" role="alert">
          {error}
        </NoticeBanner>
      )}
      {storageError && (
        <NoticeBanner tone="danger" role="alert">
          注文の再確認情報を保存・復元できません。重複注文を防ぐため注文を停止しました。
        </NoticeBanner>
      )}
      {attempt && (
        <NoticeBanner tone="warning" role="status">
          送信済みの注文を再確認できます。内容を変更せず「同じ注文を再確認」を押してください。
        </NoticeBanner>
      )}
      <fieldset disabled={locked} className="space-y-5 disabled:opacity-70">
        <section className="space-y-3 border-b pb-5" aria-labelledby="delivery-heading">
          <h2 className="text-heading-m" id="delivery-heading">
            お届け先
          </h2>
          {addressLoading ? (
            <p role="status">お届け先を読み込んでいます…</p>
          ) : addressError ? (
            <div>
              <p role="alert">{addressError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReload((value) => value + 1)}
              >
                再読み込み
              </Button>
            </div>
          ) : !addresses.length ? (
            <p>お届け先を登録してください。</p>
          ) : (
            <label className="block space-y-2">
              <span className="sr-only">お届け先を選択</span>
              <select
                className="min-h-12 w-full rounded-md border bg-base px-3"
                value={delivery.addressId}
                onChange={(event) => {
                  const address = addresses.find((item) => item.id === event.target.value);
                  setDelivery({
                    ...delivery,
                    addressId: event.target.value,
                    deliveryNote: address?.deliveryNote ?? '',
                  });
                }}
              >
                <option value="">選んでください</option>
                {addresses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label && `${item.label}：`}
                    {item.address} {item.building}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedAddress && (
            <p className="text-body-s break-words">
              {selectedAddress.address}
              <br />
              {selectedAddress.building}
            </p>
          )}
          {!locked && (
            <Link
              href="/addresses"
              className="text-body-s text-brand inline-flex min-h-11 items-center underline"
            >
              お届け先を登録・変更する
            </Link>
          )}
        </section>
        <fieldset className="space-y-3 border-b pb-5">
          <legend className="text-heading-m mb-3">受け取り方法</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['hand_delivery', '手渡し'],
                ['leave_at_door', '置き配'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-md border ${delivery.fulfillment === value ? 'bg-brand-subtle text-brand border-strong' : ''}`}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  value={value}
                  checked={delivery.fulfillment === value}
                  onChange={() => setDelivery({ ...delivery, fulfillment: value })}
                />
                {label}
              </label>
            ))}
          </div>
          {delivery.fulfillment === 'leave_at_door' && (
            <label className="block space-y-2">
              <span>置き場所（必須）</span>
              <select
                className="min-h-12 w-full rounded-md border bg-base px-3"
                value={delivery.dropoffLocation ?? ''}
                onChange={(event) =>
                  setDelivery({
                    ...delivery,
                    dropoffLocation: (event.target.value ||
                      undefined) as Delivery['dropoffLocation'],
                  })
                }
              >
                <option value="">選んでください</option>
                <option value="front_door">玄関前</option>
                <option value="delivery_box">宅配ボックス</option>
                <option value="other">その他（配達メモに記入）</option>
              </select>
            </label>
          )}
          <label className="block space-y-2">
            <span>配達メモ（任意・100文字以内）</span>
            <textarea
              className="min-h-20 w-full rounded-md border p-3"
              maxLength={100}
              value={delivery.deliveryNote}
              onChange={(event) => setDelivery({ ...delivery, deliveryNote: event.target.value })}
              placeholder="例：インターホンを鳴らしてください"
            />
          </label>
        </fieldset>
      </fieldset>
      {cart && summaryMatches && (
        <section className="space-y-3 border-b pb-5" aria-labelledby="summary-heading">
          <h2 className="text-heading-m" id="summary-heading">
            注文内容
          </h2>
          <p className="text-label-l">{cart.store.name}</p>
          <dl className="text-body-s space-y-3">
            {cart.items.map((item) => (
              <div className="flex justify-between gap-4" key={item.productId}>
                <dt className="break-words">
                  {item.name} × {item.quantity}
                </dt>
                <dd className="shrink-0">{formatYen(item.unitPrice * item.quantity)}</dd>
              </div>
            ))}
            {totals.status === 'ok' && (
              <>
                <div className="flex justify-between">
                  <dt>配達料</dt>
                  <dd>{formatYen(totals.deliveryFee)}</dd>
                </div>
                <div className="text-label-l flex justify-between border-t pt-3">
                  <dt>合計（税込・目安）</dt>
                  <dd>{formatYen(totals.total)}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="text-body-s text-secondary">金額は注文時にお店の最新情報で確定します。</p>
          {!orderable && <p role="alert">最低注文金額とカートの内容を確認してください。</p>}
          {!locked && (
            <Link
              href="/cart"
              className="text-body-s text-brand inline-flex min-h-11 items-center underline"
            >
              カートを変更する
            </Link>
          )}
        </section>
      )}
      {attempt && !summaryMatches && (
        <section className="space-y-2">
          <h2 className="text-heading-m">送信済みの注文内容</h2>
          <p className="text-body-s">カートが変更されています。送信済みの注文を再確認します。</p>
          <ul>
            {attempt.body.items.map((item) => (
              <li key={item.menuItemId} className="text-body-s break-all">
                商品 {item.menuItemId} × {item.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!attempt && (
        <section aria-labelledby="payment-heading" className="space-y-3">
          <h2 className="text-heading-m" id="payment-heading">
            お支払い
          </h2>
          <StripeCard
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
            disabled={pending}
            onReady={setPayment}
          />
        </section>
      )}
      <div className="bg-base sticky bottom-0 z-20 space-y-2 border-t py-3">
        <Button
          className="w-full"
          type="submit"
          loading={pending}
          disabled={
            storageError ||
            (!attempt && (!orderable || addressLoading || !!addressError || !addresses.length))
          }
        >
          {pending ? '注文を確認しています…' : attempt ? '同じ注文を再確認' : '注文を確定する'}
        </Button>
        <p className="text-body-s text-secondary">お店の受付時にお支払いが確定します。</p>
      </div>
    </form>
  );
}
