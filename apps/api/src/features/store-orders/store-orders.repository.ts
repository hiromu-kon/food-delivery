import { orders, orderItems, storeStaffMemberships, users, type Db } from '@repo/db';
import { DomainError } from '@repo/domain';
import { and, desc, eq, exists } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export function createStoreOrderRepository(db: Db) {
  const scope = (userId: string, storeId: string) =>
    and(
      eq(orders.storeId, storeId),
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
              eq(storeStaffMemberships.storeId, orders.storeId),
            ),
          ),
      ),
    );
  return {
    transaction: <T>(fn: (tx: Tx) => Promise<T>) => db.transaction(fn),
    async list(userId: string, storeId: string) {
      return db
        .select()
        .from(orders)
        .where(scope(userId, storeId))
        .orderBy(desc(orders.createdAt), desc(orders.id));
    },
    async lock(tx: Tx, userId: string, storeId: string, id: string) {
      const [row] = await tx
        .select()
        .from(orders)
        .where(and(scope(userId, storeId), eq(orders.id, id)))
        .for('update');
      if (!row) throw new DomainError('NOT_FOUND', '注文が見つかりません');
      return row;
    },
    async items(tx: Tx, id: string) {
      return tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, id))
        .orderBy(orderItems.menuItemId);
    },
    async update(tx: Tx, id: string, values: Partial<typeof orders.$inferInsert>) {
      await tx.update(orders).set(values).where(eq(orders.id, id));
    },
  };
}
