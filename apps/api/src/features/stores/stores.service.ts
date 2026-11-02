import { storeSearchResultSchema } from '@repo/contract';
import type { Db } from '@repo/db';
import { distanceMeters, DomainError, isWithinDeliveryRadius } from '@repo/domain';

import { createStoreRepository } from './stores.repository';

export function createStoreService(db: Db) {
  const repository = createStoreRepository(db);
  return {
    async search(userId: string, addressId: string) {
      const address = await repository.findOwnedAddress(userId, addressId);
      if (!address) throw new DomainError('NOT_FOUND', 'お届け先が見つかりません');
      // N04: 最大100店舗を一括取得し、外部呼出しや店舗ごとのSQLを発行しない。
      return (await repository.list())
        .map((store) => ({ ...store, distanceMeters: distanceMeters(address, store) }))
        .filter((store) => isWithinDeliveryRadius(store.distanceMeters, store.deliveryRadiusMeters))
        .sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id))
        .map((store) =>
          storeSearchResultSchema.parse({ ...store, canOrder: store.isAcceptingOrders }),
        );
    },
  };
}
