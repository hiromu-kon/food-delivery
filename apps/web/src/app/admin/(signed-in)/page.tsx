import Link from 'next/link';
import { requireAdminContext } from '@/features/admin-auth/session';

export default async function AdminDashboardPage() {
  await requireAdminContext();
  return (
    <>
      <h1 className="text-heading-l">運営管理</h1>
      <p className="text-body-m">運営アカウントでログインしています。</p>
      <Link href="/admin/couriers">配達員の管理</Link>
    </>
  );
}

export const instant = false;
