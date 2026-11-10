'use client';

import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';

export default function StoreError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-110 space-y-5 p-6">
      <NoticeBanner tone="danger" role="alert">
        店舗の利用状態を確認できませんでした。接続を確認して再試行してください。
      </NoticeBanner>
      <Button onClick={reset}>再試行</Button>
    </main>
  );
}
