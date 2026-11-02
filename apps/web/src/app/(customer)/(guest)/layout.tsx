import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { getSession } from '@/features/auth/session';
import Loading from '../loading';

async function GuestOnly({ children }: { children: ReactNode }) {
  const { user, blocked } = await getSession();
  if (blocked || (user && user.role !== 'customer')) redirect('/access-denied');
  if (user) redirect('/');
  return children;
}
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <GuestOnly>{children}</GuestOnly>
    </Suspense>
  );
}
