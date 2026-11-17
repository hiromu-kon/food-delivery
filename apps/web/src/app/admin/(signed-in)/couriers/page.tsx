import { requireAdminContext } from '@/features/admin-auth/session';
import { CourierManager } from '@/features/courier-admin/courier-manager';

export default async function CouriersPage() {
  await requireAdminContext();
  return <CourierManager />;
}
export const instant = false;
