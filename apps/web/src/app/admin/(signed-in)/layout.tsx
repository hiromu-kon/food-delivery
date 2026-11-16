import { Suspense, type ReactNode } from 'react';

import { AdminSessionGuard } from '@/features/admin-auth/session-guard';
import { requireAdminContext } from '@/features/admin-auth/session';

async function SignedIn({ children }: { children: ReactNode }) {
  await requireAdminContext();
  return <AdminSessionGuard>{children}</AdminSessionGuard>;
}

export default function AdminSignedInLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          運営の利用状態を確認しています…
        </p>
      }
    >
      <SignedIn>{children}</SignedIn>
    </Suspense>
  );
}

export const instant = false;
