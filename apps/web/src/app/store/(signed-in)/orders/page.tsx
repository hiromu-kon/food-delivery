import { requireStoreContext } from '@/features/store-auth/session';
import { StoreOrders } from '@/features/store-orders/store-orders';

export default async function StoreOrdersPage() {
  const context = await requireStoreContext();
  return <StoreOrders key={`${context.user.id}:${context.store.id}`} />;
}

export const instant = false;
