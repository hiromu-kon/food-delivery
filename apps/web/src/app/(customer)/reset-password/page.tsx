import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/features/auth/auth-shell';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';
export const metadata: Metadata = {
  title: '新しいパスワード | Food Delivery',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
async function ResetPasswordContent({ searchParams }: PageProps<'/reset-password'>) {
  const query = await searchParams;
  const token = typeof query.token === 'string' && query.token.length <= 512 ? query.token : '';
  return (
    <AuthShell
      title="新しいパスワード"
      description="ほかのサービスと異なるパスワードをおすすめします。"
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

export default function ResetPasswordPage(props: PageProps<'/reset-password'>) {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Spinner />
        </div>
      }
    >
      <ResetPasswordContent {...props} />
    </Suspense>
  );
}
