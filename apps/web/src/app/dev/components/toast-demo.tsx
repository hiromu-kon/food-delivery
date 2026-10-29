'use client';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export function ToastDemo() {
  return (
    <div className="flex gap-3">
      <Button variant="secondary" size="M" onClick={() => toast.success('注文を取り消しました')}>
        success を出す
      </Button>
      <Button
        variant="secondary"
        size="M"
        onClick={() => toast.error('通信できませんでした。もう一度お試しください')}
      >
        error を出す
      </Button>
    </div>
  );
}
