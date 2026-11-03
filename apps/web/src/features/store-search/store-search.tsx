'use client';

import { addressSchema, storeSearchResponseSchema } from '@repo/contract';
import { defaultCartDeliveryFee } from '@repo/domain';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { StoreCard } from '@/components/ui/store-card';
import {
  assertSearchSuccess,
  SearchError,
  StoreSearchRequests,
  type SearchResult,
} from './search-state';

const source = {
  async addresses() {
    const response = await apiClient.addresses.$get();
    assertSearchSuccess(response);
    return z.object({ addresses: z.array(addressSchema) }).parse(await response.json()).addresses;
  },
  async stores(addressId: string) {
    const response = await apiClient.stores.$get({ query: { addressId } });
    assertSearchSuccess(response);
    return storeSearchResponseSchema.parse(await response.json()).stores;
  },
};

export function StoreSearch({ userId }: { userId: string }) {
  const [result, setResult] = useState<SearchResult>({ addresses: [], selectedId: '', stores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requests = useRef(new StoreSearchRequests());
  const selected = useRef('');
  const storageKey = `store-search-address:${userId}`;

  const reload = useCallback(
    (preferredId = selected.current) => {
      selected.current = preferredId;
      setResult((current) => ({ ...current, selectedId: preferredId, stores: [] }));
      setLoading(true);
      setError('');
      void requests.current.run(
        source,
        preferredId,
        (next) => {
          selected.current = next.selectedId;
          setResult(next);
          setLoading(false);
          try {
            if (next.selectedId) sessionStorage.setItem(storageKey, next.selectedId);
            else sessionStorage.removeItem(storageKey);
          } catch {
            /* 保存できない環境では表示中の選択を使う */
          }
        },
        (cause) => {
          setLoading(false);
          if (cause instanceof SearchError && cause.status === 401)
            window.location.replace('/login');
          else if (cause instanceof SearchError && cause.status === 403)
            window.location.replace('/access-denied');
          else setError('店舗一覧を取得できませんでした。接続を確認して、もう一度お試しください。');
        },
      );
    },
    [storageKey],
  );

  useEffect(() => {
    const activeRequests = requests.current;
    let preferredId = '';
    try {
      preferredId = sessionStorage.getItem(storageKey) ?? '';
    } catch {
      /* 保存は任意 */
    }
    reload(preferredId);
    const refresh = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      activeRequests.cancel();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [storageKey, reload]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="delivery-address" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label id="delivery-address" htmlFor="address-choice" className="text-heading-m">
            お届け先
          </label>
          <Link href="/addresses" className="text-body-m text-brand underline">
            お届け先を登録・編集
          </Link>
        </div>
        {result.addresses.length > 0 && (
          <select
            id="address-choice"
            value={result.selectedId}
            onChange={(event) => reload(event.target.value)}
            className="text-body-m w-full min-w-0 rounded-md border bg-surface px-3 py-3"
          >
            {result.addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.address} {address.building}
              </option>
            ))}
          </select>
        )}
      </section>
      <section aria-labelledby="store-list" aria-busy={loading} className="space-y-5">
        <h2 id="store-list" className="text-heading-m">
          お届けできるお店
        </h2>
        {loading && (
          <p role="status" className="text-body-m text-secondary">
            お届け先とお店を確認しています…
          </p>
        )}
        {error && (
          <div className="space-y-3">
            <NoticeBanner tone="danger" role="alert">
              {error}
            </NoticeBanner>
            <Button variant="secondary" onClick={() => reload()}>
              もう一度試す
            </Button>
          </div>
        )}
        {!loading &&
          !error &&
          (result.addresses.length === 0 ? (
            <p className="text-body-m text-secondary">
              お届け先がまだ登録されていません。お届け先を登録すると、配達できるお店を探せます。
            </p>
          ) : result.stores.length === 0 ? (
            <p className="text-body-m text-secondary">
              このお届け先に配達できるお店はまだありません。別のお届け先をお試しください。
            </p>
          ) : (
            <>
              <p className="text-body-s text-secondary">
                配達料は目安です。確定金額は注文時にご確認ください。メニューの閲覧・注文は準備中です。
              </p>
              <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {result.stores.map((store) => (
                  <li key={store.id}>
                    <StoreCard
                      name={store.name}
                      {...(store.photoUrl ? { photoUrl: store.photoUrl } : {})}
                      paused={!store.canOrder}
                      deliveryFee={defaultCartDeliveryFee}
                      minimumOrderAmount={store.minimumOrderAmount}
                      distanceMeters={store.distanceMeters}
                    />
                  </li>
                ))}
              </ul>
            </>
          ))}
      </section>
    </div>
  );
}
