import { addressSchema } from '@repo/contract';
import { z } from 'zod';
import { createServerApiClient } from '@/api/server';
import type { Metadata } from 'next';
import { UserIcon, MapPinIcon, FileTextIcon, ShieldIcon } from 'lucide-react';
import { ListItem } from '@/components/ui/list-item';
import { AuthShell } from '@/features/auth/auth-shell';
import { LogoutButton } from '@/features/auth/logout-button';
import { requireCustomer } from '@/features/auth/session';
export const metadata: Metadata = { title: 'アカウント | Food Delivery' };
export default async function AccountPage() {
  const user = await requireCustomer();
  let defaultLabel: string | undefined;
  try {
    const client = await createServerApiClient();
    const response = await client.addresses.$get();
    if (response.ok) {
      const { addresses } = z
        .object({ addresses: z.array(addressSchema) })
        .parse(await response.json());
      defaultLabel = addresses.find((address) => address.isDefault)?.label || undefined;
    }
  } catch {
    // 住所の取得に失敗しても、設定への導線は残す。
  }
  return (
    <AuthShell title="アカウント">
      <div className="space-y-5">
        <section aria-label="登録情報" className="flex items-center gap-3">
          <div className="bg-subtle flex size-14 shrink-0 items-center justify-center rounded-full">
            <UserIcon className="text-secondary size-6.5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-0.5 break-words">
            <h2 className="text-heading-m">{user.name}</h2>
            <p className="text-body-s text-secondary break-all">{user.email}</p>
            <p className="text-body-s text-secondary">{user.phoneNumber}</p>
            <p className="text-body-s text-secondary">
              メールアドレス：{user.emailVerified ? '確認済み' : '未確認'}
            </p>
          </div>
        </section>
        <nav aria-label="アカウントの設定">
          <ListItem
            href="/addresses"
            title="お届け先"
            icon={<MapPinIcon />}
            {...(defaultLabel ? { value: defaultLabel } : {})}
          />
          <ListItem href="/terms" title="利用規約" icon={<FileTextIcon />} />
          <ListItem href="/privacy" title="プライバシーポリシー" icon={<ShieldIcon />} />
          <LogoutButton />
        </nav>
        <p className="text-body-s text-secondary">
          登録情報を変えるとき、退会するときは、お問い合わせ窓口に連絡してください。
        </p>
      </div>
    </AuthShell>
  );
}

// 認証結果によるリダイレクトを待つ画面のため、即時遷移の検証対象から外す。
export const instant = false;
