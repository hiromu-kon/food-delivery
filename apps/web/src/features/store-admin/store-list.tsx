'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { listStores, storeAdminMessage, type ManagedStore } from './requests';

export function StoreList() {
  const [stores, setStores] = useState<ManagedStore[]>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void listStores(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setStores(rows);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(storeAdminMessage(err));
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-heading-l">店舗一覧</h1>
        <Button asChild>
          <Link href="/admin/stores/new">店舗を登録</Link>
        </Button>
      </div>
      {error ? (
        <>
          <NoticeBanner tone="danger" role="alert">
            {error}
          </NoticeBanner>
          <Button
            onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}
          >
            再読み込み
          </Button>
        </>
      ) : !stores ? (
        <p role="status">店舗を読み込んでいます…</p>
      ) : stores.length === 0 ? (
        <p>登録された店舗はありません。</p>
      ) : (
        <ul className="divide-default divide-y">
          {stores.map((store) => (
            <li key={store.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="min-w-0 break-words">
                <h2 className="text-heading-s">{store.name}</h2>
                <p>{store.address}</p>
                <p className="text-body-s">
                  配達半径 {store.deliveryRadiusMeters} m ／ 最低注文金額 {store.minimumOrderAmount}{' '}
                  円 ／ {store.isAcceptingOrders ? '受付中' : '受付停止中'}
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link href={`/admin/stores/${store.id}`}>
                  編集<span className="sr-only">：{store.name}</span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
