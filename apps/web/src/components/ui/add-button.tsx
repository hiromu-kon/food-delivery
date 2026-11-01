import { PlusIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

function AddButton({
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & { 'aria-label': string }) {
  return (
    <button
      type="button"
      data-slot="add-button"
      className={cn(
        'bg-brand text-on-brand hover:bg-brand-hover disabled:bg-disabled disabled:text-disabled inline-flex size-10.5 shrink-0 items-center justify-center rounded-full border-3 border-(--background-color-base) outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus) disabled:pointer-events-none',
        className,
      )}
      {...props}
    >
      <PlusIcon className="size-5" aria-hidden />
    </button>
  );
}

export { AddButton };
