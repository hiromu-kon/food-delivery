import { CustomerNavigation } from '@/components/customer/customer-navigation';
import { Suspense, type ReactNode } from 'react';
import { requireCustomer } from '@/features/auth/session';
import { SessionGuard } from '@/features/auth/session-guard';
import Loading from '../loading';

async function SignedIn({ children }: { children: ReactNode }) {
  await requireCustomer();
  return (
    <SessionGuard>
      <CustomerNavigation />
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
