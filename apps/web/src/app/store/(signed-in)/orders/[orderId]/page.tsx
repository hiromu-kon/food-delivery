import { requireStoreContext } from '@/features/store-auth/session';
import { StoreOrder } from '@/features/store-orders/store-orders';

export default async function StoreOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const context = await requireStoreContext();
  const { orderId } = await params;
  return <StoreOrder key={`${context.user.id}:${context.store.id}:${orderId}`} id={orderId} />;
}

export const instant = false;
