import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/features/auth/auth-shell';
import { LoginForm } from '@/features/auth/login-form';
export const metadata: Metadata = { title: 'ログイン | Food Delivery' };
async function LoginContent({ searchParams }: PageProps<'/login'>) {
  const query = await searchParams;
  return (
    <AuthShell login title="Food Delivery" description="近くのお店の料理を、お届けします">
      <LoginForm verified={query.verified === 'true'} />
    </AuthShell>
  );
}

export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Spinner />
        </div>
      }
    >
      <LoginContent {...props} />
    </Suspense>
  );
}

// 認証結果によるリダイレクトを待つ画面のため、即時遷移の検証対象から外す。
export const instant = false;
