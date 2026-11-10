import { storeMeResponseSchema } from '@repo/contract';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createServerApiClient } from '@/api/server';

// レンダー内だけ共有する。API が毎リクエストで role・所属を確認する。
// 店舗データを取得する境界からも呼び、layout の再利用だけに依存しない。
export const requireStoreContext = cache(async () => {
  const client = await createServerApiClient();
  const response: Response = await client.store.me.$get({ query: {} });
  if (response.status === 401) redirect('/store/login');
  if (response.status === 403) redirect('/store/login?reason=denied');
  if (!response.ok) throw new Error('店舗の利用状態を確認できませんでした');
  return storeMeResponseSchema.parse(await response.json());
});
