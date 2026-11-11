import { formatYen } from '@repo/domain';
import { cn } from '@repo/native-ui/cn';
import { CountBadge } from '@repo/native-ui/count-badge';
import { Text } from '@repo/native-ui/text';
import * as React from 'react';
import { Pressable } from 'react-native';

type CartBarProps = Omit<React.ComponentProps<typeof Pressable>, 'children'> & {
  count: number;
  subtotal: number;
};

function CartBar({ count, subtotal, className, ...props }: CartBarProps) {
  if (count <= 0) return null;
  return (
    <Pressable
      role="button"
      accessibilityLabel={`カートを見る、${count}点、小計${formatYen(subtotal)}`}
      className={cn(
        'bg-brand active:bg-brand-hover shadow-raised min-h-14.5 flex-row flex-wrap items-center gap-3 rounded-lg px-4 py-3',
        className,
      )}
      {...props}
    >
      <CountBadge count={count} />
      <Text variant="label-l" className="text-on-brand flex-1 text-center">
        カートを見る
      </Text>
      <Text variant="label-l" className="text-on-brand">
        {formatYen(subtotal)}
      </Text>
    </Pressable>
  );
}

export { CartBar };
