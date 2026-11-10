import { Suspense } from 'react';
import { requireCustomer } from '@/features/auth/session';
import { StoreMenu } from '@/features/menu/store-menu';

async function MenuPage({ params }: PageProps<'/stores/[storeId]/menu'>) {
  const user = await requireCustomer();
  const { storeId } = await params;
  return <StoreMenu key={`${user.id}:${storeId}`} storeId={storeId} />;
}

export default function Page(props: PageProps<'/stores/[storeId]/menu'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-body-m p-6">
          メニューを確認しています…
        </p>
      }
    >
      <MenuPage {...props} />
    </Suspense>
  );
}

export const instant = false;
