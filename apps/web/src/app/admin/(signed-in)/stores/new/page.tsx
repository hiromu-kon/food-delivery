import { requireAdminContext } from '@/features/admin-auth/session';
import { StoreEditor } from '@/features/store-admin/store-editor';
export default async function NewStorePage() {
  await requireAdminContext();
  return <StoreEditor />;
}
export const instant = false;
