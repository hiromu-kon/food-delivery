import { cn } from '@repo/native-ui/cn';
import { Icon } from '@repo/native-ui/icon';
import { Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

type AddButtonProps = Omit<React.ComponentProps<typeof Pressable>, 'children'> & {
  accessibilityLabel: string;
};

function AddButton({ className, disabled, ...props }: AddButtonProps) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={4}
      className={cn(
        'border-(--background-color-base) size-10.5 items-center justify-center rounded-full border-3',
        disabled ? 'bg-disabled' : 'bg-brand active:bg-brand-hover',
        className,
      )}
      {...props}
    >
      <Icon as={Plus} className={disabled ? 'text-disabled' : 'text-on-brand'} aria-hidden />
    </Pressable>
  );
}

export { AddButton };
