import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Check } from 'lucide-react-native';
import * as React from 'react';

import { cn } from '../cn';
import { Icon } from './icon';

// 22px の箱は指で押しにくいため、押せる範囲を周りに広げる
const HIT_SLOP = 12;

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      hitSlop={HIT_SLOP}
      className={cn(
        'border-strong bg-base size-5.5 shrink-0 items-center justify-center rounded-xs border',
        props.checked && 'bg-brand border-transparent',
        props.disabled && 'bg-disabled border-transparent',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="items-center justify-center">
        <Icon
          as={Check}
          strokeWidth={3}
          className={cn('text-on-brand size-4', props.disabled && 'text-disabled')}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
