import { MenuManagement } from '@/features/menu-management/menu-management';
import { requireStoreContext } from '@/features/store-auth/session';

export default async function StoreMenuPage() {
  const context = await requireStoreContext();
  return <MenuManagement key={`${context.user.id}:${context.store.id}`} />;
}
