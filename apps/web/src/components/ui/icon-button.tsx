import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/cn';

const iconButtonVariants = cva(
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-primary transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus) disabled:pointer-events-none disabled:text-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        filled: 'bg-base shadow-raised hover:bg-subtle',
        plain: 'hover:bg-subtle',
      },
    },
    defaultVariants: {
      variant: 'plain',
    },
  },
);

// 文字がないため、読み上げ用の名前を型で必須にする
type IconButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof iconButtonVariants> & {
    'aria-label': string;
  };

function IconButton({ className, variant = 'plain', ...props }: IconButtonProps) {
  return (
    <button
      data-slot="icon-button"
      className={cn(iconButtonVariants({ variant, className }))}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
