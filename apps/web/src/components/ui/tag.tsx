import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/cn';

const tagVariants = cva(
  'text-label-s inline-flex h-4.5 shrink-0 items-center rounded-xs px-2 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-disabled text-secondary',
        warning: 'bg-warning-subtle text-warning',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

function Tag({
  className,
  tone = 'neutral',
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof tagVariants>) {
  return <span data-slot="tag" className={cn(tagVariants({ tone, className }))} {...props} />;
}

export { Tag, tagVariants };
