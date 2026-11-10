import { requireStoreContext } from '@/features/store-auth/session';

export default async function StoreDashboardPage() {
  await requireStoreContext();
  return <h1 className="text-heading-l">店舗管理</h1>;
}
