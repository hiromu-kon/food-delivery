import * as React from 'react';

import { cn } from '@/lib/cn';

function StoreNoren({
  name,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & { name: string; description?: string }) {
  return (
    <div
      data-slot="store-noren"
      className={cn(
        'bg-brand relative min-h-31 overflow-hidden rounded-t-xs px-6 pt-5 pb-8',
        className,
      )}
      {...props}
    >
      <h2 className="text-display text-on-brand font-display break-words">{name}</h2>
      {description && <p className="text-body-s text-on-brand-subtle mt-2">{description}</p>}
      <div className="absolute inset-x-0 bottom-0 flex h-5.5" aria-hidden>
        <div className="flex-1 border-r-2 border-(--background-color-base)" />
        <div className="flex-1 border-x-2 border-(--background-color-base)" />
        <div className="flex-1 border-l-2 border-(--background-color-base)" />
      </div>
    </div>
  );
}

export { StoreNoren };
