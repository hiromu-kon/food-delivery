'use client';

import { getCartQuantityControls } from '@repo/domain';
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

const controlClassName =
  'hover:bg-subtle disabled:text-disabled inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus) disabled:pointer-events-none';

type QuantityStepperProps = Omit<React.ComponentProps<'div'>, 'children'> & {
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
  const DecreaseIcon = decreaseTo === 0 ? Trash2Icon : MinusIcon;
  return (
    <div
      role="group"
      aria-label={`${itemName}の数量`}
      data-slot="quantity-stepper"
      className={cn(
        'border-strong inline-flex min-h-10 items-center gap-2 self-start rounded-full border px-1',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        className={controlClassName}
        aria-label={decreaseTo === 0 ? `${itemName}をカートから外す` : `${itemName}の数量を減らす`}
        disabled={disabled || decreaseTo === null}
        onClick={() => {
          if (decreaseTo === 0) onRemove();
          else if (decreaseTo !== null) onQuantityChange(decreaseTo);
        }}
      >
        <DecreaseIcon className="size-4.5" aria-hidden />
      </button>
      <output
        className="text-label-l min-w-7 text-center tabular-nums"
        aria-label={`${itemName}の数量`}
        aria-live="polite"
      >
        {quantity}
      </output>
      <button
        type="button"
        className={controlClassName}
        aria-label={`${itemName}の数量を増やす`}
        disabled={disabled || increaseTo === null}
        onClick={() => {
          if (increaseTo !== null) onQuantityChange(increaseTo);
        }}
      >
        <PlusIcon className="size-4.5" aria-hidden />
      </button>
    </div>
  );
}

export { QuantityStepper };
