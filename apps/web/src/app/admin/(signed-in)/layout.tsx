import { BikeIcon, ReceiptTextIcon, StoreIcon } from 'lucide-react';

import { SideNav } from '@/components/ui/side-nav';

// 運営の画面はデザインを作らず、店舗と同じ部品で組む。
export default function AdminSignedInLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex flex-1">
      <SideNav
        title="Food Delivery"
        subtitle="運営の管理"
        items={[
          { href: '/admin/orders', label: '注文', icon: <ReceiptTextIcon /> },
          { href: '/admin/stores', label: '店舗', icon: <StoreIcon /> },
          { href: '/admin/couriers', label: '配達員', icon: <BikeIcon /> },
        ]}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-10 pt-8 pb-10">{children}</main>
    </div>
  );
}
