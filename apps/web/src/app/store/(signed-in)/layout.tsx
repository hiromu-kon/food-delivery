import { Suspense, type ReactNode } from 'react';

import { StoreSessionGuard } from '@/features/store-auth/session-guard';
import { requireStoreContext } from '@/features/store-auth/session';

async function SignedIn({ children }: { children: ReactNode }) {
  await requireStoreContext();
  return <StoreSessionGuard>{children}</StoreSessionGuard>;
}

export default function StoreSignedInLayout({ children }: LayoutProps<'/store'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          店舗の利用状態を確認しています…
        </p>
      }
    >
      <SignedIn>{children}</SignedIn>
    </Suspense>
  );
}

export const instant = false;
