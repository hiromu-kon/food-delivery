import { storeStaffMemberships, stores, users, type Db } from '@repo/db';
import { eq } from 'drizzle-orm';

export function createStoreAuthRepository(db: Db) {
  return {
    async findContext(userId: string) {
      return (
        await db
          .select({ user: users, store: { id: stores.id, name: stores.name } })
          .from(users)
          .innerJoin(storeStaffMemberships, eq(storeStaffMemberships.userId, users.id))
          .innerJoin(stores, eq(stores.id, storeStaffMemberships.storeId))
          .where(eq(users.id, userId))
          .limit(1)
      )[0];
    },
  };
}
