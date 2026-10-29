import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircleIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/cn';

// 処理中も種類の色のまま見せるため、無効の色は aria-busy でないときだけにする
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus) disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5",
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-on-brand hover:bg-brand-hover disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled',
        secondary:
          'border-strong bg-base text-primary hover:bg-subtle disabled:not-aria-busy:border-default disabled:not-aria-busy:text-disabled',
        ghost: 'text-brand hover:bg-brand-subtle disabled:not-aria-busy:text-disabled',
        danger:
          'bg-danger text-on-brand hover:bg-danger-hover disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled',
      },
      size: {
        L: 'text-label-l h-12 px-5',
        M: 'text-label-m h-10 px-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'L',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

function Button({
  className,
  variant = 'primary',
  size = 'L',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircleIcon className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
