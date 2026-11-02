'use client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { AuthShell } from '@/features/auth/auth-shell';

export default function CustomerError() {
  return (
    <AuthShell title="画面を表示できませんでした">
      <div className="space-y-6">
        <NoticeBanner tone="danger" role="alert">
          通信の状態を確認して、もう一度お試しください。
        </NoticeBanner>
        <Button onClick={() => window.location.reload()} className="w-full">
          もう一度読み込む
        </Button>
      </div>
    </AuthShell>
  );
}
