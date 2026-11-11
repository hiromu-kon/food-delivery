import { storeStaffMemberships, stores, users, type Db } from '@repo/db';
import { and, eq, exists } from 'drizzle-orm';

export function createStoreAcceptanceRepository(db: Db) {
  return {
    async read(userId: string, storeId: string) {
      return (
        await db
          .select({ id: stores.id, isAcceptingOrders: stores.isAcceptingOrders })
          .from(stores)
          .innerJoin(storeStaffMemberships, eq(storeStaffMemberships.storeId, stores.id))
          .innerJoin(users, eq(users.id, storeStaffMemberships.userId))
          .where(
            and(
              eq(stores.id, storeId),
              eq(users.id, userId),
              eq(users.role, 'store'),
              eq(users.disabled, false),
              eq(users.emailVerified, true),
            ),
          )
          .limit(1)
      )[0];
    },
    async update(userId: string, storeId: string, isAcceptingOrders: boolean) {
      // guard 後の所属・権限変更も、更新時の同じ SQL で照合する。
      return (
        await db
          .update(stores)
          .set({ isAcceptingOrders })
          .where(
            and(
              eq(stores.id, storeId),
              exists(
                db
                  .select({ id: users.id })
                  .from(users)
                  .innerJoin(storeStaffMemberships, eq(storeStaffMemberships.userId, users.id))
                  .where(
                    and(
                      eq(users.id, userId),
                      eq(users.role, 'store'),
                      eq(users.disabled, false),
                      eq(users.emailVerified, true),
                      eq(storeStaffMemberships.storeId, stores.id),
                    ),
                  ),
              ),
            ),
          )
          .returning({ id: stores.id, isAcceptingOrders: stores.isAcceptingOrders })
      )[0];
    },
  };
}
