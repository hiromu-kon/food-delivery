import * as React from 'react';

import { cn } from '@/lib/cn';

type EmptyStateProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action: React.ReactNode;
};

// 空の画面で次にすることがわからなくならないよう、action を必須にする
function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-8 text-center [&>svg]:size-10 [&>svg]:text-disabled',
        className,
      )}
      {...props}
    >
      {icon}
      <p className="text-heading-m text-primary">{title}</p>
      {description && <p className="text-body-m text-secondary">{description}</p>}
      {action}
    </div>
  );
}

export { EmptyState };
