import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';

export function ResourceFeedback({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="space-y-3">
      <NoticeBanner tone="danger" role="alert">
        {error}
      </NoticeBanner>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={retry}>
          再読み込み
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/orders">注文履歴へ</Link>
        </Button>
      </div>
    </div>
  );
}

export function orderDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value));
}
