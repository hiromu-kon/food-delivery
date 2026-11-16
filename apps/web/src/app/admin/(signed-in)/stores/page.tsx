import { requireAdminContext } from '@/features/admin-auth/session';
import { StoreList } from '@/features/store-admin/store-list';
export default async function StoresPage() {
  await requireAdminContext();
  return <StoreList />;
}
export const instant = false;
