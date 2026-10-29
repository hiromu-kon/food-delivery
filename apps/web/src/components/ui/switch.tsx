'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/cn';

// Penpot の Toggle。shadcn には押したままになるボタンの Toggle が別にあり、名前がぶつかるため Switch のままにする。
// オフの地の色は Penpot で入力欄の枠と同じトークンを使っているため、背景のクラスではなく枠の変数を参照する。
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer enabled:data-checked:bg-brand enabled:data-unchecked:bg-(--border-color-strong) disabled:bg-disabled inline-flex h-7 w-12 shrink-0 items-center rounded-full px-0.75 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus) disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-base pointer-events-none block size-5.5 rounded-full transition-transform data-checked:translate-x-5 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
