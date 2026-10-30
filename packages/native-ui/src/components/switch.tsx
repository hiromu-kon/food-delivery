import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';

import { cn } from '../cn';

// Penpot の Toggle。Web と同じく Switch の名前にする（docs/design/components.md）。
// オフの地の色は Penpot で入力欄の枠と同じトークンを使っているため、枠の変数を参照する。
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'h-7 w-12 shrink-0 flex-row items-center rounded-full px-0.75',
        props.checked ? 'bg-brand' : 'bg-(--border-color-strong)',
        props.disabled && 'bg-disabled',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn('bg-base size-5.5 rounded-full', props.checked && 'translate-x-5')}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
