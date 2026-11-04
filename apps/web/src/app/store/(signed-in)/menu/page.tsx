import { requireStoreContext } from '@/features/store-auth/session';

export default async function StorePlaceholderPage() {
  await requireStoreContext();
  return <h1 className="text-heading-l">メニュー</h1>;
}
