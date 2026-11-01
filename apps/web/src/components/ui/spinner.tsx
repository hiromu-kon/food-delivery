import { LoaderCircleIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

type SpinnerProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  label?: string;
};

function Spinner({ label = '読み込んでいます', className, ...props }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn('text-brand inline-flex size-8 items-center justify-center', className)}
      {...props}
    >
      <LoaderCircleIcon className="size-7 animate-spin" aria-hidden />
    </span>
  );
}

export { Spinner };
