'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

export type CardElement = {
  mount(node: HTMLElement): void;
  destroy(): void;
  on(
    event: 'change',
    callback: (value: { complete: boolean; error?: { message: string } }) => void,
  ): void;
  update(options: { disabled: boolean }): void;
};
export type StripeClient = {
  elements(options: { locale: 'ja' }): { create(type: 'card', options: object): CardElement };
  createPaymentMethod(options: { type: 'card'; card: CardElement }): Promise<{
    paymentMethod?: { id: string };
    error?: { message?: string };
  }>;
};
declare global {
  interface Window {
    Stripe?: (key: string) => StripeClient;
  }
}
export type CardPayment = { create(): Promise<string> };
export async function createCardPayment(stripe: StripeClient, card: CardElement) {
  const result = await stripe.createPaymentMethod({ type: 'card', card });
  if (result.error || !result.paymentMethod?.id)
    throw new Error(result.error?.message ?? 'カード情報を確認してください。');
  return result.paymentMethod.id;
}
export function StripeCard({
  publishableKey,
  disabled,
  onReady,
}: {
  publishableKey?: string | undefined;
  disabled: boolean;
  onReady: (payment: CardPayment | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const card = useRef<CardElement | null>(null);
  const readyCallback = useRef(onReady);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const testKey = !!publishableKey?.startsWith('pk_test_');
  useEffect(() => {
    readyCallback.current = onReady;
  }, [onReady]);
  useEffect(() => {
    if (!loaded || !testKey || !host.current || !window.Stripe) return;
    let active = true;
    try {
      const stripe = window.Stripe(publishableKey!);
      const element = stripe.elements({ locale: 'ja' }).create('card', {
        hidePostalCode: true,
        style: {
          base: { fontSize: '16px', color: '#1d2126', '::placeholder': { color: '#66707c' } },
        },
      });
      card.current = element;
      element.on('change', (value) => {
        if (!active) return;
        setComplete(value.complete);
        setError(value.error?.message ?? '');
        readyCallback.current(
          value.complete ? { create: () => createCardPayment(stripe, element) } : null,
        );
      });
      element.mount(host.current);
      return () => {
        active = false;
        readyCallback.current(null);
        element.destroy();
        card.current = null;
      };
    } catch {
      readyCallback.current(null);
      queueMicrotask(() =>
        setError('カード入力を開始できません。ページを再読み込みしてください。'),
      );
    }
  }, [loaded, testKey, publishableKey]);
  useEffect(() => {
    if (!testKey || loaded) return;
    const timer = setTimeout(
      () => setError('カード入力を読み込めません。ページを再読み込みしてください。'),
      15_000,
    );
    return () => clearTimeout(timer);
  }, [testKey, loaded]);
  useEffect(() => {
    card.current?.update({ disabled });
  }, [disabled, loaded]);
  return (
    <div className="space-y-2">
      {testKey && (
        <Script
          src="https://js.stripe.com/v3/"
          onReady={() => setLoaded(true)}
          onError={() => setError('カード入力を読み込めません。ページを再読み込みしてください。')}
        />
      )}
      <p className="text-body-s text-secondary" id="card-label">
        カード番号・有効期限・セキュリティコード
      </p>
      <div
        ref={host}
        role="group"
        aria-labelledby="card-label"
        className="min-h-12 rounded-md border bg-base p-3"
      />
      {!testKey ? (
        <p role="alert">テスト決済は現在利用できません。</p>
      ) : !loaded && !error ? (
        <p role="status">カード入力を読み込んでいます…</p>
      ) : null}
      {error && (
        <p role="alert" className="text-body-s text-danger">
          {error}
        </p>
      )}
      {complete && (
        <p role="status" className="text-body-s text-secondary">
          カード情報を入力しました。
        </p>
      )}
      <p className="text-body-s text-secondary">
        カード情報は決済会社が管理し、このサービスには保存しません。テストカードのみ利用できます。
      </p>
    </div>
  );
}
