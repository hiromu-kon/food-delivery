import { addresses, stores, type Db } from '@repo/db';
import { and, eq } from 'drizzle-orm';

export function createStoreRepository(db: Db) {
  return {
    async findOwnedAddress(userId: string, addressId: string) {
      return (
        await db
          .select({ latitude: addresses.latitude, longitude: addresses.longitude })
          .from(addresses)
          .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
          .limit(1)
      )[0];
    },
    list: () => db.select().from(stores),
  };
}
