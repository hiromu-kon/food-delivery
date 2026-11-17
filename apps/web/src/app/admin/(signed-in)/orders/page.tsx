import { requireAdminContext } from '@/features/admin-auth/session';
import { AdminOrders } from '@/features/admin-orders/admin-orders';

export default async function AdminOrdersPage() {
  await requireAdminContext();
  return <AdminOrders />;
}
export const instant = false;
