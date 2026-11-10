'use client';

import { formatYen } from '@repo/domain';
import * as React from 'react';

import { AddButton } from '@/components/ui/add-button';
import { FoodPhoto } from '@/components/ui/food-photo';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/cn';

type MenuItemProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  name: string;
  description?: string;
  price: number;
  photoUrl?: string;
  soldOut?: boolean;
  disabled?: boolean;
  onAdd?: () => void;
};

function MenuItem({
  name,
  description,
  price,
  photoUrl,
  soldOut = false,
  disabled = false,
  onAdd,
  className,
  ...props
}: MenuItemProps) {
  return (
    <div
      data-slot="menu-item"
      className={cn('border-default flex items-start gap-4 border-b py-4', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className={cn('text-body-l break-words', soldOut && 'text-secondary')}>{name}</h3>
        {description && (
          <p className="text-body-s text-secondary break-words whitespace-pre-line">
            {description}
          </p>
        )}
        <div className="py-1">
          <p className="text-label-l">{formatYen(price)}</p>
          {soldOut && <Tag>売り切れ</Tag>}
        </div>
      </div>
      <div className={cn('relative shrink-0', photoUrl ? 'size-25' : 'self-center')}>
        {photoUrl && (
          <FoodPhoto
            photoUrl={photoUrl}
            alt={`${name}の写真`}
            className={cn('size-24', soldOut && 'opacity-45')}
          />
        )}
        {!soldOut && onAdd && (
          <AddButton
            className={photoUrl ? 'absolute -right-0.75 -bottom-0.75' : undefined}
            aria-label={`${name}をカートに入れる`}
            disabled={disabled}
            onClick={onAdd}
          />
        )}
      </div>
    </div>
  );
}

export { MenuItem };
