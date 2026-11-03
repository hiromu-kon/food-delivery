import { addresses, users, type Db } from '@repo/db';
import { and, asc, eq } from 'drizzle-orm';

export function createAddressRepository(db: Db) {
  const owned = (userId: string, id: string) =>
    and(eq(addresses.id, id), eq(addresses.userId, userId));
  // 住所がまだないユーザーも含め、全書き込みを同じ親行で直列化する。
  const locked = <T>(
    userId: string,
    action: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
  ) =>
    db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      return action(tx);
    });
  return {
    list: (userId: string) =>
      db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(asc(addresses.id)),
    async find(userId: string, id: string) {
      return (await db.select().from(addresses).where(owned(userId, id)).limit(1))[0];
    },
    async insert(values: typeof addresses.$inferInsert) {
      return locked(values.userId, async (tx) => {
        if (values.isDefault)
          await tx
            .update(addresses)
            .set({ isDefault: false })
            .where(and(eq(addresses.userId, values.userId), eq(addresses.isDefault, true)));
        const [row] = await tx.insert(addresses).values(values).returning();
        if (!row) throw new Error('住所を保存できませんでした');
        return row;
      });
    },
    async update(
      userId: string,
      id: string,
      values: Partial<Omit<typeof addresses.$inferInsert, 'id' | 'userId'>>,
    ) {
      return locked(userId, async (tx) => {
        const [existing] = await tx
          .select({ id: addresses.id })
          .from(addresses)
          .where(owned(userId, id));
        if (!existing) return undefined;
        if (values.isDefault)
          await tx
            .update(addresses)
            .set({ isDefault: false })
            .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
        return (await tx.update(addresses).set(values).where(owned(userId, id)).returning())[0];
      });
    },
    async delete(userId: string, id: string) {
      return locked(
        userId,
        async (tx) =>
          (await tx.delete(addresses).where(owned(userId, id)).returning({ id: addresses.id }))[0],
      );
    },
  };
}
