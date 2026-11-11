import { storeAcceptanceResponseSchema, storeMeResponseSchema } from '@repo/contract';

import { apiClient } from '@/api/client';

export class AcceptanceError extends Error {
  constructor(readonly status: number) {
    super('受付状態を確認できません');
  }
}

async function read(response: Response): Promise<unknown> {
  if (!response.ok) throw new AcceptanceError(response.status);
  return response.json();
}

export async function loadAcceptance() {
  const context = storeMeResponseSchema.parse(
    await read(await apiClient.store.me.$get({ query: {} })),
  );
  const result = storeAcceptanceResponseSchema.parse(
    await read(await apiClient.store.acceptance.$get()),
  );
  if (result.store.id !== context.store.id) throw new AcceptanceError(403);
  return { ...context.store, isAcceptingOrders: result.store.isAcceptingOrders };
}

export async function saveAcceptance(storeId: string, isAcceptingOrders: boolean) {
  const context = storeMeResponseSchema.parse(
    await read(await apiClient.store.me.$get({ query: {} })),
  );
  if (context.store.id !== storeId) throw new AcceptanceError(403);
  const result = storeAcceptanceResponseSchema.parse(
    await read(await apiClient.store.acceptance.$patch({ json: { isAcceptingOrders } })),
  );
  if (result.store.id !== storeId) throw new AcceptanceError(403);
  return result.store;
}
