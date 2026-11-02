import { formatYen } from '@repo/domain';
import * as React from 'react';

import { CountBadge } from '@/components/ui/count-badge';
import { cn } from '@/lib/cn';

function CartBar({
  count,
  subtotal,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & { count: number; subtotal: number }) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      data-slot="cart-bar"
      aria-label={`カートを見る、${count}点、小計${formatYen(subtotal)}`}
      className={cn(
        'bg-brand text-on-brand hover:bg-brand-hover shadow-raised flex min-h-14.5 w-full flex-wrap items-center gap-3 rounded-lg px-4 py-3 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus) disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CountBadge count={count} />
      <span className="text-label-l flex-1 text-center">カートを見る</span>
      <span className="text-label-l">{formatYen(subtotal)}</span>
    </button>
  );
}

export { CartBar };
