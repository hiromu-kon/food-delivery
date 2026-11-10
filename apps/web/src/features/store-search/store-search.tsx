'use client';

import { addressSchema, storeSearchResponseSchema } from '@repo/contract';
import { defaultCartDeliveryFee } from '@repo/domain';
import Link from 'next/link';
import { ChevronDownIcon, MapPinIcon } from 'lucide-react';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { ListItem } from '@/components/ui/list-item';
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
  const [choosing, setChoosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requests = useRef(new StoreSearchRequests());
  const selected = useRef('');
  const storageKey = `store-search-address:${userId}`;

  const reload = useCallback(
    (preferredId = selected.current) => {
      selected.current = preferredId;
      // 店舗取得が終わる前に遷移しても明示選択を失わない。
      try {
        if (preferredId) sessionStorage.setItem(storageKey, preferredId);
        else sessionStorage.removeItem(storageKey);
      } catch {
        /* 保存できない環境では表示中の選択を使う */
      }
      setResult((current) => ({ ...current, selectedId: preferredId, stores: [] }));
      setLoading(true);
      setError('');
      void requests.current.run(
        source,
        preferredId,
        (next) => {
          // 自動復旧先は明示選択として保存しない。
          selected.current = preferredId === next.selectedId ? preferredId : '';
          setResult(next);
          setLoading(false);
          try {
            if (selected.current) sessionStorage.setItem(storageKey, selected.current);
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

  const selectedAddress = result.addresses.find((address) => address.id === result.selectedId);

  return (
    <div>
      <Drawer open={choosing} onOpenChange={setChoosing}>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="flex min-h-16 w-full items-center gap-3 border-b px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-(--border-color-focus)"
          >
            <MapPinIcon className="text-brand size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="text-body-s text-secondary block">お届け先</span>
              <span className="text-label-m block break-words">
                {selectedAddress
                  ? `${selectedAddress.label ? `${selectedAddress.label}：` : ''}${selectedAddress.address} ${selectedAddress.building}`.trim()
                  : 'お届け先を選択・登録する'}
              </span>
            </span>
            <ChevronDownIcon className="size-5 shrink-0" aria-hidden />
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>お届け先を選ぶ</DrawerTitle>
          <DrawerDescription>配達先を選ぶと、配達できるお店が変わります。</DrawerDescription>
          <div>
            {result.addresses.map((address) => (
              <ListItem
                key={address.id}
                title={address.label || address.address}
                description={
                  address.label ? `${address.address} ${address.building}`.trim() : address.building
                }
                selected={address.id === result.selectedId}
                chevron={false}
                onClick={() => {
                  reload(address.id);
                  setChoosing(false);
                }}
              />
            ))}
          </div>
          <Button asChild variant="secondary" className="w-full" onClick={() => setChoosing(false)}>
            <Link href="/addresses">お届け先を追加・編集する</Link>
          </Button>
        </DrawerContent>
      </Drawer>
      <section aria-labelledby="store-list" aria-busy={loading} className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 id="store-list" className="text-heading-l">
            配達できるお店
          </h1>
          {!loading && !error && (
            <p className="text-body-m text-secondary">{result.stores.length} 店</p>
          )}
        </div>
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
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.stores.map((store) => (
                  <li key={store.id}>
                    <StoreCard
                      href={`/stores/${store.id}/menu`}
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
              <p className="text-body-s text-secondary">
                配達料は目安です。確定金額は注文時にご確認ください。注文は準備中です。
              </p>
            </>
          ))}
      </section>
    </div>
  );
}
