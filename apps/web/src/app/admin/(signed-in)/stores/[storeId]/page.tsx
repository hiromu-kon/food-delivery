import { notFound } from 'next/navigation';
import { managedStoreIdSchema } from '@repo/contract';
import { requireAdminContext } from '@/features/admin-auth/session';
import { StoreEditor } from '@/features/store-admin/store-editor';
export default async function EditStorePage({ params }: { params: Promise<{ storeId: string }> }) {
  await requireAdminContext();
  const parsed = managedStoreIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return <StoreEditor key={parsed.data.storeId} storeId={parsed.data.storeId} />;
}
export const instant = false;
