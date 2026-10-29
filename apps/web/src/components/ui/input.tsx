import * as React from 'react';

import { cn } from '@/lib/cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-strong bg-base text-body-l text-primary placeholder:text-secondary aria-invalid:border-danger disabled:border-default disabled:bg-subtle disabled:text-disabled h-12 w-full min-w-0 rounded-sm border px-4 transition-colors outline-none focus:border-focus focus:outline-2 focus:outline-solid focus:-outline-offset-2 focus:outline-(--border-color-focus) disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
