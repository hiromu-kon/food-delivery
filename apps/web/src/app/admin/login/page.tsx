import { Suspense } from 'react';

import { AdminLoginForm } from '@/features/admin-auth/login-form';

async function AdminLoginContent({ searchParams }: PageProps<'/admin/login'>) {
  const { reason } = await searchParams;
  return (
    <main className="bg-subtle flex min-h-dvh flex-1 items-center justify-center px-5 py-10">
      <section
        className="bg-base border-default flex w-full max-w-110 flex-col gap-5 rounded-md border p-6 sm:p-10"
        aria-labelledby="admin-login-title"
      >
        <header className="space-y-2">
          <p className="text-brand font-display text-[30px]">Food Delivery</p>
          <h1 id="admin-login-title" className="text-label-m text-secondary">
            運営の管理
          </h1>
        </header>
        <p className="text-body-m">運営アカウントでログインしてください</p>
        <AdminLoginForm denied={reason === 'denied'} />
      </section>
    </main>
  );
}

export default function AdminLoginPage(props: PageProps<'/admin/login'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          読み込んでいます…
        </p>
      }
    >
      <AdminLoginContent {...props} />
    </Suspense>
  );
}

export const instant = false;
