import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/features/auth/auth-shell';
import { requireCustomer } from '@/features/auth/session';

// お届け先の一覧と編集は F-02（#11）で実装する。
export const instant = false;

export default async function AddressesPage() {
  await requireCustomer();
  return (
    <AuthShell title="お届け先の管理">
      <div className="space-y-6">
        <p className="text-body-m text-secondary">お届け先の登録・変更は現在準備中です。</p>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/account">アカウントへ戻る</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
