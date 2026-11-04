import { Suspense } from 'react';

import { StoreLoginForm } from '@/features/store-auth/login-form';

async function StoreLoginContent({ searchParams }: PageProps<'/store/login'>) {
  const { reason } = await searchParams;
  return (
    <main className="bg-subtle flex min-h-dvh flex-1 items-center justify-center px-5 py-10">
      <section
        className="bg-base border-default flex w-full max-w-110 flex-col gap-5 rounded-md border p-6 sm:p-10"
        aria-labelledby="store-login-title"
      >
        <header className="space-y-2">
          <p className="text-brand font-display text-[30px]">Food Delivery</p>
          <h1 id="store-login-title" className="text-label-m text-secondary">
            店舗の管理
          </h1>
        </header>
        <p className="text-body-m">運営から届いたアカウントでログインしてください</p>
        <StoreLoginForm denied={reason === 'denied'} />
      </section>
    </main>
  );
}

export default function StoreLoginPage(props: PageProps<'/store/login'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          読み込んでいます…
        </p>
      }
    >
      <StoreLoginContent {...props} />
    </Suspense>
  );
}

export const instant = false;
