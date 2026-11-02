import Link from 'next/link';
import { LegalLinks } from '@/features/auth/auth-shell';

export default function CustomerLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-18 max-w-6xl items-center px-5 sm:px-8">
          <Link href="/" className="text-heading-m text-brand font-display font-bold">
            Food Delivery
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
