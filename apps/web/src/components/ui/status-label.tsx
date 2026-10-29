import type { OrderStatus } from '@repo/domain';
import {
  BikeIcon,
  CircleCheckIcon,
  ClockIcon,
  type LucideIcon,
  PackageIcon,
  UtensilsCrossedIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

const statusStyles = {
  pending: { label: '受付待ち', icon: ClockIcon, className: 'bg-warning-subtle text-warning' },
  preparing: {
    label: '調理中',
    icon: UtensilsCrossedIcon,
    className: 'bg-brand-subtle text-brand',
  },
  ready: { label: '準備完了', icon: PackageIcon, className: 'bg-brand-subtle text-brand' },
  delivering: { label: '配達中', icon: BikeIcon, className: 'bg-brand text-on-brand' },
  delivered: {
    label: '配達完了',
    icon: CircleCheckIcon,
    className: 'bg-success-subtle text-success',
  },
  canceled: { label: 'キャンセル', icon: XIcon, className: 'bg-disabled text-secondary' },
} satisfies Record<OrderStatus, { label: string; icon: LucideIcon; className: string }>;

type StatusLabelProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  status: OrderStatus;
};

function StatusLabel({ status, className, ...props }: StatusLabelProps) {
  const { label, icon: Icon, className: statusClassName } = statusStyles[status];
  return (
    <span
      data-slot="status-label"
      data-status={status}
      className={cn(
        'text-label-s inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full px-3 whitespace-nowrap',
        statusClassName,
        className,
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export { StatusLabel };
