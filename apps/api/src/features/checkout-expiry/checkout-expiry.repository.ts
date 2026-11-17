import { checkoutAttempts, orders, type Db } from '@repo/db';
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export function createCheckoutExpiryRepository(db: Db) {
  return {
    transaction: <T>(fn: (tx: Tx) => Promise<T>) => db.transaction(fn),
    async candidates(cutoff: Date, after?: string) {
      return db
        .select({ id: checkoutAttempts.id })
        .from(checkoutAttempts)
        .leftJoin(orders, eq(orders.id, checkoutAttempts.id))
        .where(
          and(
            isNull(orders.id),
            isNull(checkoutAttempts.paymentVoidedAt),
            lte(checkoutAttempts.createdAt, cutoff),
            after ? gt(checkoutAttempts.id, after) : undefined,
          ),
        )
        .orderBy(asc(checkoutAttempts.id))
        .limit(100);
    },
    async lock(tx: Tx, id: string) {
      const [attempt] = await tx
        .select()
        .from(checkoutAttempts)
        .where(eq(checkoutAttempts.id, id))
        .for('update');
      const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, id));
      return { attempt, order };
    },
    async complete(tx: Tx, id: string, at: Date) {
      await tx
        .update(checkoutAttempts)
        .set({ failed: 1, paymentVoidedAt: at })
        .where(eq(checkoutAttempts.id, id));
    },
  };
}
