import { getCartQuantityControls } from '@repo/domain';
import { cn } from '@repo/native-ui/cn';
import { Icon } from '@repo/native-ui/icon';
import { Text } from '@repo/native-ui/text';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type QuantityStepperProps = React.ComponentProps<typeof View> & {
  quantity: number;
  itemName: string;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  disabled?: boolean;
};

function QuantityStepper({
  quantity,
  itemName,
  onQuantityChange,
  onRemove,
  disabled = false,
  className,
  ...props
}: QuantityStepperProps) {
  const { decreaseTo, increaseTo } = getCartQuantityControls(quantity);
  const decreaseDisabled = disabled || decreaseTo === null;
  const increaseDisabled = disabled || increaseTo === null;
  const remove = decreaseTo === 0;
  return (
    <View
      className={cn(
        'border-strong min-h-10 flex-row items-center self-start gap-2 rounded-full border px-1',
        className,
      )}
      {...props}
    >
      <Pressable
        role="button"
        accessibilityLabel={remove ? `${itemName}をカートから外す` : `${itemName}の数量を減らす`}
        disabled={decreaseDisabled}
        accessibilityState={{ disabled: decreaseDisabled }}
        className="active:bg-subtle size-8 items-center justify-center rounded-full"
        hitSlop={4}
        onPress={() => {
          if (decreaseTo === 0) onRemove();
          else if (decreaseTo !== null) onQuantityChange(decreaseTo);
        }}
      >
        <Icon
          as={remove ? Trash2 : Minus}
          className={cn('size-4.5', decreaseDisabled && 'text-disabled')}
          aria-hidden
        />
      </Pressable>
      <Text
        variant="label-l"
        className="min-w-7 text-center tabular-nums"
        accessibilityLabel={`${itemName}の数量、${quantity}点`}
        accessibilityLiveRegion="polite"
      >
        {quantity}
      </Text>
      <Pressable
        role="button"
        accessibilityLabel={`${itemName}の数量を増やす`}
        disabled={increaseDisabled}
        accessibilityState={{ disabled: increaseDisabled }}
        className="active:bg-subtle size-8 items-center justify-center rounded-full"
        hitSlop={4}
        onPress={() => {
          if (increaseTo !== null) onQuantityChange(increaseTo);
        }}
      >
        <Icon
          as={Plus}
          className={cn('size-4.5', increaseDisabled && 'text-disabled')}
          aria-hidden
        />
      </Pressable>
    </View>
  );
}

export { QuantityStepper };
