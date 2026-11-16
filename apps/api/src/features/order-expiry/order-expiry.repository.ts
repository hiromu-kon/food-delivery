import { orders, type Db } from '@repo/db';
import { and, asc, eq, gt, isNull, lte, or } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export function createOrderExpiryRepository(db: Db) {
  return {
    transaction: <T>(fn: (tx: Tx) => Promise<T>) => db.transaction(fn),
    async candidates(cutoff: Date, after?: string) {
      return db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            after ? gt(orders.id, after) : undefined,
            isNull(orders.captureStartedAt),
            or(
              and(eq(orders.status, 'pending'), lte(orders.createdAt, cutoff)),
              and(
                eq(orders.status, 'canceled'),
                eq(orders.cancellationReason, 'expired'),
                isNull(orders.paymentVoidedAt),
              ),
            ),
          ),
        )
        .orderBy(asc(orders.id))
        .limit(100);
    },
    async lock(tx: Tx, id: string) {
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      return row;
    },
    async update(tx: Tx, id: string, values: Partial<typeof orders.$inferInsert>) {
      await tx.update(orders).set(values).where(eq(orders.id, id));
    },
  };
}
