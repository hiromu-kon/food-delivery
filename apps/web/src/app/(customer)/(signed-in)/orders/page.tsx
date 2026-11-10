import { AuthShell } from '@/features/auth/auth-shell';
import { OrderHistory } from '@/features/orders/order-history';

export default function OrdersPage() {
  return (
    <AuthShell title="注文履歴">
      <OrderHistory />
    </AuthShell>
  );
}
