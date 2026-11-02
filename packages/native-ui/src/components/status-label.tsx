import type { OrderStatus } from '@repo/domain';
import { Bike, CircleCheck, Clock, Package, UtensilsCrossed, X } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { Text } from './text';

const statusStyles = {
  pending: {
    label: '受付待ち',
    icon: Clock,
    background: 'bg-warning-subtle',
    color: 'text-warning',
  },
  preparing: {
    label: '調理中',
    icon: UtensilsCrossed,
    background: 'bg-brand-subtle',
    color: 'text-brand',
  },
  ready: { label: '準備完了', icon: Package, background: 'bg-brand-subtle', color: 'text-brand' },
  delivering: { label: '配達中', icon: Bike, background: 'bg-brand', color: 'text-on-brand' },
  delivered: {
    label: '配達完了',
    icon: CircleCheck,
    background: 'bg-success-subtle',
    color: 'text-success',
  },
  canceled: { label: 'キャンセル', icon: X, background: 'bg-disabled', color: 'text-secondary' },
} satisfies Record<
  OrderStatus,
  { label: string; icon: typeof Clock; background: string; color: string }
>;

function StatusLabel({
  status,
  className,
  ...props
}: React.ComponentProps<typeof View> & { status: OrderStatus }) {
  const { label, icon, background, color } = statusStyles[status];
  return (
    <View
      className={cn(
        'h-5.5 flex-row items-center self-start gap-1 rounded-full px-3',
        background,
        className,
      )}
      {...props}
    >
      <Icon as={icon} className={cn('size-3.5', color)} aria-hidden />
      <Text variant="label-s" className={color}>
        {label}
      </Text>
    </View>
  );
}

export { StatusLabel };
