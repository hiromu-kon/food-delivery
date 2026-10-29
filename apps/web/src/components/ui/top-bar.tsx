import { UserIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

const receptionStatuses = {
  open: {
    label: '受付中',
    description: 'お客様から注文できます',
    dotClassName: 'bg-(--text-color-success)',
  },
  stopped: {
    label: '受付停止中',
    description: '新しい注文は来ません。再開は「店舗の設定」から',
    dotClassName: 'bg-(--text-color-warning)',
  },
} as const;

type TopBarProps = React.ComponentProps<'header'> & {
  // 運営の画面には店舗の受付の状態がないため、省略できる
  receptionStatus?: keyof typeof receptionStatuses;
  account: string;
};

function TopBar({ receptionStatus, account, className, ...props }: TopBarProps) {
  const status = receptionStatus && receptionStatuses[receptionStatus];

  return (
    <header
      data-slot="top-bar"
      className={cn(
        'border-default bg-base flex h-16 shrink-0 items-center justify-between gap-6 border-b px-10',
        className,
      )}
      {...props}
    >
      {status ? (
        <div className="flex items-center gap-2.5">
          <span className={cn('size-2.5 shrink-0 rounded-full', status.dotClassName)} aria-hidden />
          <div className="flex flex-col">
            <p className="text-label-m text-primary">{status.label}</p>
            <p className="text-body-s text-secondary">{status.description}</p>
          </div>
        </div>
      ) : (
        <div />
      )}
      <div className="text-body-m text-primary flex items-center gap-2">
        <UserIcon className="text-secondary size-5 shrink-0" aria-hidden />
        {account}
      </div>
    </header>
  );
}

export { TopBar };
