import { AuthShell } from '@/features/auth/auth-shell';
import { OrderDetail } from '@/features/orders/order-detail';

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <AuthShell title="注文状況" backHref="/orders">
      <OrderDetail key={orderId} orderId={orderId} />
    </AuthShell>
  );
}
