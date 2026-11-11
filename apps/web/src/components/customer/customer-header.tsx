import Link from 'next/link';

import { cn } from '@/lib/cn';

type CustomerHeaderProps = {
  brandHref?: string;
  items: { href: string; label: string; current?: boolean }[];
  className?: string;
};

function CustomerHeader({ brandHref = '/', items, className }: CustomerHeaderProps) {
  return (
    <header
      data-slot="customer-header"
      className={cn('bg-base border-default hidden border-b md:block', className)}
    >
      <div className="mx-auto flex min-h-16 max-w-300 flex-wrap items-center justify-between gap-6 px-6 py-2">
        <Link
          href={brandHref}
          className="text-heading-l text-brand font-display rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-(--border-color-focus)"
        >
          Food Delivery
        </Link>
        <nav aria-label="注文者メニュー">
          <ul className="flex flex-wrap items-center gap-6">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className={cn(
                    'text-body-m text-secondary hover:text-brand inline-flex min-h-11 items-center border-b-3 border-transparent outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--border-color-focus)',
                    item.current && 'text-label-m text-brand border-(--background-color-brand)',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export { CustomerHeader };
