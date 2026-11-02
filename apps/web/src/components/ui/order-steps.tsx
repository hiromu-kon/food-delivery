import { getOrderProgress, type OrderStatus } from '@repo/domain';
import * as React from 'react';

import { StatusLabel } from '@/components/ui/status-label';
import { cn } from '@/lib/cn';

const labels = {
  pending: '受付待ち',
  preparing: '調理中',
  ready: '準備完了',
  delivering: '配達中',
  delivered: '配達完了',
};

function OrderSteps({
  status,
  className,
  ...props
}: Omit<React.ComponentProps<'ol'>, 'children'> & { status: OrderStatus }) {
  const steps = getOrderProgress(status);
  if (!steps)
    return (
      <ol aria-label="注文の進行状況" data-slot="order-steps" className={className} {...props}>
        <li className="flex">
          <StatusLabel status="canceled" />
        </li>
      </ol>
    );
  return (
    <ol
      aria-label="注文の進行状況"
      data-slot="order-steps"
      className={cn('flex', className)}
      {...props}
    >
      {steps.map((step, index) => (
        <li
          key={step.status}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="flex min-w-0 flex-1 flex-col items-center gap-2"
        >
          <div className="flex h-6 w-full items-center" aria-hidden>
            <span
              className={cn(
                'h-0.75 flex-1',
                step.state !== 'upcoming' ? 'bg-brand' : 'bg-(--border-color-default)',
                index === 0 && 'invisible',
              )}
            />
            <span
              className={cn(
                'size-3 shrink-0 rounded-full',
                step.state === 'upcoming' ? 'bg-(--border-color-strong)' : 'bg-brand',
                step.state === 'current' &&
                  'size-6 border-4 border-(--background-color-brand-subtle)',
              )}
            />
            <span
              className={cn(
                'h-0.75 flex-1',
                step.state === 'completed' ? 'bg-brand' : 'bg-(--border-color-default)',
                index === steps.length - 1 && 'invisible',
              )}
            />
          </div>
          <span
            className={cn(
              'text-center',
              step.state === 'current'
                ? 'text-label-s text-brand'
                : step.state === 'upcoming'
                  ? 'text-body-s text-secondary'
                  : 'text-body-s text-primary',
            )}
          >
            {labels[step.status]}
          </span>
          <span className="sr-only">
            {step.state === 'current' ? '現在' : step.state === 'completed' ? '完了' : '未完了'}
          </span>
        </li>
      ))}
    </ol>
  );
}

export { OrderSteps };
