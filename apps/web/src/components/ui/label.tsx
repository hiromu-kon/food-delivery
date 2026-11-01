'use client';

import { Label as LabelPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/cn';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'text-label-m text-primary peer-disabled:text-disabled group-data-[disabled=true]:text-disabled flex items-center gap-2 select-none',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
