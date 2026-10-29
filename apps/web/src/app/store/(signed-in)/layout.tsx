import { ReceiptTextIcon, StoreIcon, UtensilsCrossedIcon } from 'lucide-react';

import { SideNav } from '@/components/ui/side-nav';

// 店舗名・受付の状態・ログイン中のアカウントは、ログイン（F-09）と受付の切替（F-12）で API から取れるようになってから出す。
export default function StoreSignedInLayout({ children }: LayoutProps<'/store'>) {
  return (
    <div className="flex flex-1">
      <SideNav
        title="Food Delivery"
        subtitle="店舗の管理"
        items={[
          { href: '/store/orders', label: '注文', icon: <ReceiptTextIcon /> },
          { href: '/store/menu', label: 'メニュー', icon: <UtensilsCrossedIcon /> },
          { href: '/store/settings', label: '店舗の設定', icon: <StoreIcon /> },
        ]}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-10 pt-8 pb-10">{children}</main>
    </div>
  );
}
