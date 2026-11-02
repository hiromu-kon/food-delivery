import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AuthShell, LegalLinks } from '@/features/auth/auth-shell';
import { LogoutButton } from '@/features/auth/logout-button';
import { requireCustomer } from '@/features/auth/session';
export const metadata: Metadata = { title: 'アカウント | Food Delivery' };
export default async function AccountPage() {
  const user = await requireCustomer();
  return (
    <AuthShell title="アカウント">
      <div className="space-y-8">
        <dl className="divide-y border-y">
          {[
            ['氏名', user.name],
            ['メールアドレス', user.email],
            ['電話番号', user.phoneNumber],
            ['メールアドレスの確認', user.emailVerified ? '確認済み' : '未確認'],
          ].map(([label, value]) => (
            <div className="space-y-2 py-4" key={label}>
              <dt className="text-body-s text-secondary">{label}</dt>
              <dd className="text-body-m break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/addresses">お届け先を管理する</Link>
        </Button>
        <section aria-label="規約">
          <LegalLinks />
        </section>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}

// 認証結果によるリダイレクトを待つ画面のため、即時遷移の検証対象から外す。
export const instant = false;
