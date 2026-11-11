import type { Db } from '@repo/db';
import { DomainError } from '@repo/domain';

import { storeAcceptanceResponseSchema } from './store-acceptance.schema';
import { createStoreAcceptanceRepository } from './store-acceptance.repository';

export function createStoreAcceptanceService(db: Db) {
  const repository = createStoreAcceptanceRepository(db);
  return {
    async read(userId: string, storeId: string) {
      const store = await repository.read(userId, storeId);
      if (!store) throw new DomainError('FORBIDDEN', 'この操作はできません');
      return storeAcceptanceResponseSchema.parse({ store });
    },
    async update(userId: string, storeId: string, isAcceptingOrders: boolean) {
      const store = await repository.update(userId, storeId, isAcceptingOrders);
      if (!store) throw new DomainError('FORBIDDEN', 'この操作はできません');
      return storeAcceptanceResponseSchema.parse({ store });
    },
  };
}
