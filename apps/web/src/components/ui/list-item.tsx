'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/cn';

type ListItemProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  value?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  tone?: 'default' | 'danger';
  className?: string;
} & (
  | { href: string; onClick?: never; disabled?: never }
  | { href?: never; onClick: React.MouseEventHandler<HTMLButtonElement>; disabled?: boolean }
  | { href?: never; onClick?: never; disabled?: never }
);

function ListItem({
  title,
  description,
  icon,
  value,
  trailing,
  chevron,
  selected,
  tone = 'default',
  className,
  href,
  onClick,
  disabled,
}: ListItemProps) {
  const interactive = Boolean(href || onClick);
  const classes = cn(
    'bg-base border-default flex min-h-14 w-full items-center gap-3 border-b px-4 py-3 text-left',
    interactive &&
      'hover:bg-subtle outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-(--border-color-focus)',
    selected && 'bg-brand-subtle hover:bg-brand-subtle',
    disabled && 'text-disabled pointer-events-none',
    className,
  );
  const content = (
    <>
      {icon && (
        <span
          className={cn(
            'text-secondary shrink-0 [&_svg]:size-5',
            selected && 'text-brand',
            disabled && 'text-disabled',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            'text-body-l break-words',
            tone === 'danger' && 'text-danger',
            selected && 'text-brand',
            disabled && 'text-disabled',
          )}
        >
          {title}
        </span>
        {description && (
          <span className={cn('text-body-s text-secondary', disabled && 'text-disabled')}>
            {description}
          </span>
        )}
      </span>
      {value && (
        <span className={cn('text-body-m text-secondary shrink-0', disabled && 'text-disabled')}>
          {value}
        </span>
      )}
      {trailing}
      {(chevron ?? interactive) && (
        <ChevronRightIcon
          className={cn('text-secondary size-5 shrink-0', disabled && 'text-disabled')}
          aria-hidden
        />
      )}
    </>
  );
  if (href)
    return (
      <Link href={href} data-slot="list-item" className={classes}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        data-slot="list-item"
        className={classes}
        disabled={disabled}
        aria-pressed={selected}
        onClick={onClick}
      >
        {content}
      </button>
    );
  return (
    <div data-slot="list-item" className={classes}>
      {content}
    </div>
  );
}

export { ListItem };
