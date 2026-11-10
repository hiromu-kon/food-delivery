import { AuthShell } from '@/features/auth/auth-shell';
import { CheckoutView } from '@/features/checkout/checkout-view';

export default function CheckoutPage() {
  return (
    <AuthShell title="注文の確認" backHref="/cart">
      <CheckoutView />
    </AuthShell>
  );
}
