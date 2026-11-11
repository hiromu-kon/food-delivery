import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/auth-shell';
import { OrderDetail } from '@/features/orders/order-detail';

type OrderPageProps = { params: Promise<{ orderId: string }> };

async function OrderContent({ params }: OrderPageProps) {
  const { orderId } = await params;
  return <OrderDetail key={orderId} orderId={orderId} />;
}

export default function OrderPage({ params }: OrderPageProps) {
  return (
    <AuthShell title="注文状況" backHref="/orders">
      <Suspense fallback={<p role="status">注文状況を読み込んでいます…</p>}>
        <OrderContent params={params} />
      </Suspense>
    </AuthShell>
  );
}
