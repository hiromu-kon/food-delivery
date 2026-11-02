import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { requireCustomer } from '@/features/auth/session';
import { SessionGuard } from '@/features/auth/session-guard';
import Loading from '../loading';

async function SignedIn({ children }: { children: ReactNode }) {
  await requireCustomer();
  return (
    <SessionGuard>
      <nav
        aria-label="注文者メニュー"
        className="mx-auto flex w-full max-w-6xl gap-6 border-b px-5 py-4 text-label-m sm:px-8"
      >
        <Link href="/" className="text-brand underline-offset-4 hover:underline">
          お店を探す
        </Link>
        <Link href="/account" className="text-brand underline-offset-4 hover:underline">
          アカウント
        </Link>
      </nav>
      {children}
    </SessionGuard>
  );
}
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <SignedIn>{children}</SignedIn>
    </Suspense>
  );
}
