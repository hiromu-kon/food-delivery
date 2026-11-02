import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/reset-password-form';
export const metadata: Metadata = { title: 'パスワード再設定 | Food Delivery' };
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="パスワード再設定"
      description="登録したメールアドレスに、再設定のリンクを送ります。"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
