import { StoreSearch } from '@/features/store-search/store-search';
import { requireCustomer } from '@/features/auth/session';
export default async function HomePage() {
  const user = await requireCustomer();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-5 py-8 sm:px-8">
      <h1 className="text-heading-l font-bold">お店を探す</h1>
      <StoreSearch key={user.id} userId={user.id} />
    </main>
  );
}

// 認証結果によるリダイレクトを待つ画面のため、即時遷移の検証対象から外す。
export const instant = false;
