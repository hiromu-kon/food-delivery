'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { CountBadge } from '@/components/ui/count-badge';
import { cn } from '@/lib/cn';

type SideNavItem = {
  href: string;
  label: string;
  // Server Component の layout から渡せるよう、アイコンは部品ではなく要素で受け取る
  icon: React.ReactNode;
  count?: number;
};

type SideNavProps = {
  title: string;
  subtitle?: string;
  items: SideNavItem[];
  footer?: React.ReactNode;
  className?: string;
};

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideNav({ title, subtitle, items, footer, className }: SideNavProps) {
  const pathname = usePathname();

  return (
    <nav
      data-slot="side-nav"
      className={cn(
        'bg-subtle sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 px-3 py-4',
        className,
      )}
    >
      <div className="flex flex-col p-3">
        <p className="text-heading-m text-primary">{title}</p>
        {subtitle && <p className="text-body-s text-secondary">{subtitle}</p>}
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'text-body-m text-primary [&_svg]:text-secondary hover:bg-disabled flex h-11 items-center gap-3 rounded-sm px-3 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-(--border-color-focus) [&_svg]:size-5 [&_svg]:shrink-0',
                  current &&
                    'bg-brand-subtle text-label-m text-brand [&_svg]:text-brand hover:bg-brand-subtle',
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && item.count > 0 && <CountBadge count={item.count} />}
              </Link>
            </li>
          );
        })}
      </ul>
      {footer && <div className="mt-auto">{footer}</div>}
    </nav>
  );
}

export { SideNav, type SideNavItem };
