import { CustomerNavigation } from '@/components/customer/customer-navigation';
import { Suspense, type ReactNode } from 'react';
import { requireCustomer } from '@/features/auth/session';
import { SessionGuard } from '@/features/auth/session-guard';
import Loading from '../loading';
import { CartProvider } from '@/features/cart/cart-provider';

async function SignedIn({ children }: { children: ReactNode }) {
  const user = await requireCustomer();
  return (
    <SessionGuard>
      <CartProvider key={user.id} userId={user.id}>
        <CustomerNavigation />
        {children}
      </CartProvider>
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
