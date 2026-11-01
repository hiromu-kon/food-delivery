import * as React from 'react';

import { cn } from '@/lib/cn';

type CountBadgeProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  count: number;
};

function CountBadge({ count, className, ...props }: CountBadgeProps) {
  return (
    <span
      data-slot="count-badge"
      className={cn(
        'bg-accent text-label-m text-primary inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 tabular-nums',
        className,
      )}
      {...props}
    >
      {count}
    </span>
  );
}

export { CountBadge };
