'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CustomerHeader } from './customer-header';

export function CustomerNavigation() {
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'お店を探す', current: pathname === '/' },
    { href: '/cart', label: 'カート', current: pathname === '/cart' },
    {
      href: '/account',
      label: 'アカウント',
      current: pathname === '/account' || pathname === '/addresses',
    },
  ];
  return (
    <>
      <CustomerHeader items={items} />
      <nav
        aria-label="注文者メニュー"
        className="text-label-m flex min-h-12 items-center gap-6 border-b px-4 md:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            className="text-brand py-3 underline-offset-4 hover:underline"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
