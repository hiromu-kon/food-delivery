import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/auth-shell';
import { SignUpForm } from '@/features/auth/sign-up-form';
export const metadata: Metadata = { title: '会員登録 | Food Delivery' };
export default function SignUpPage() {
  return (
    <AuthShell
      title="会員登録"
      description="登録後に届くメールから、メールアドレスを確認してください。"
    >
      <SignUpForm />
    </AuthShell>
  );
}

// 認証結果によるリダイレクトを待つ画面のため、即時遷移の検証対象から外す。
export const instant = false;
