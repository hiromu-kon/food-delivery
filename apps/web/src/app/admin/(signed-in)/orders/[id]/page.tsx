import { requireAdminContext } from '@/features/admin-auth/session';
import { AdminOrders } from '@/features/admin-orders/admin-orders';

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminContext();
  const { id } = await params;
  return <AdminOrders key={id} id={id} />;
}
export const instant = false;
