import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlertIcon, InfoIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

const noticeBannerVariants = cva('text-body-m flex items-center gap-2 rounded-sm px-4 py-3', {
  variants: {
    tone: {
      info: 'bg-brand-subtle text-brand',
      warning: 'bg-warning-subtle text-warning',
      danger: 'bg-danger-subtle text-danger',
    },
  },
  defaultVariants: {
    tone: 'info',
  },
});

function NoticeBanner({
  className,
  tone = 'info',
  children,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof noticeBannerVariants>) {
  const Icon = tone === 'info' ? InfoIcon : CircleAlertIcon;
  return (
    <div
      data-slot="notice-banner"
      className={cn(noticeBannerVariants({ tone, className }))}
      {...props}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { NoticeBanner, noticeBannerVariants };
