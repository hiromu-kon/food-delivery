import { getOrderProgress, type OrderStatus } from '@repo/domain';
import { cn } from '@repo/native-ui/cn';
import { StatusLabel } from '@repo/native-ui/status-label';
import { Text } from '@repo/native-ui/text';
import * as React from 'react';
import { View } from 'react-native';

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
}: React.ComponentProps<typeof View> & { status: OrderStatus }) {
  const steps = getOrderProgress(status);
  if (!steps) return <StatusLabel status="canceled" className={cn(className)} {...props} />;
  return (
    <View className={cn('flex-row', className)} {...props}>
      {steps.map((step, index) => (
        <View
          key={step.status}
          className="min-w-0 flex-1 items-center gap-2"
          accessibilityLabel={`${labels[step.status]}、${step.state === 'current' ? '現在' : step.state === 'completed' ? '完了' : '未完了'}`}
          accessible
          accessibilityRole="text"
        >
          <View className="h-4 w-full flex-row items-center" aria-hidden>
            <View
              className={cn(
                'h-0.75 flex-1',
                step.state !== 'upcoming' ? 'bg-brand' : 'bg-(--border-color-default)',
                index === 0 && 'opacity-0',
              )}
            />
            <View
              className={cn(
                'size-3 rounded-full',
                step.state === 'upcoming' ? 'bg-(--border-color-strong)' : 'bg-brand',
                step.state === 'current' &&
                  'border-(--background-color-brand-subtle) size-6 border-4',
              )}
            />
            <View
              className={cn(
                'h-0.75 flex-1',
                step.state === 'completed' ? 'bg-brand' : 'bg-(--border-color-default)',
                index === steps.length - 1 && 'opacity-0',
              )}
            />
          </View>
          <View className="min-h-5 w-full items-center justify-center">
            <Text
              variant={step.state === 'current' ? 'label-s' : 'body-s'}
              className={cn(
                'text-center',
                step.state === 'current'
                  ? 'text-brand'
                  : step.state === 'upcoming'
                    ? 'text-secondary'
                    : 'text-primary',
              )}
            >
              {labels[step.status]}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export { OrderSteps };
