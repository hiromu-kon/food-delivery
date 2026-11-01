import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';

const iconButtonVariants = cva('size-10 items-center justify-center rounded-full', {
  variants: {
    variant: {
      filled: 'bg-base active:bg-subtle shadow-raised',
      plain: 'active:bg-subtle',
    },
  },
  defaultVariants: {
    variant: 'plain',
  },
});

// 文字がないため、読み上げ用の名前を型で必須にする
type IconButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof iconButtonVariants> & {
    icon: LucideIcon;
    accessibilityLabel: string;
  };

function IconButton({ icon, variant = 'plain', disabled, className, ...props }: IconButtonProps) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      className={cn(iconButtonVariants({ variant }), className)}
      {...props}
    >
      <Icon as={icon} className={cn('text-primary', disabled && 'text-disabled')} />
    </Pressable>
  );
}

export { IconButton, iconButtonVariants };
