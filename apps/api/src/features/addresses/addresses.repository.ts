import { addresses, type Db } from '@repo/db';
import { and, asc, eq } from 'drizzle-orm';

export function createAddressRepository(db: Db) {
  const owned = (userId: string, id: string) =>
    and(eq(addresses.id, id), eq(addresses.userId, userId));
  return {
    list: (userId: string) =>
      db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(asc(addresses.id)),
    async find(userId: string, id: string) {
      return (await db.select().from(addresses).where(owned(userId, id)).limit(1))[0];
    },
    async insert(values: typeof addresses.$inferInsert) {
      const [row] = await db.insert(addresses).values(values).returning();
      if (!row) throw new Error('住所を保存できませんでした');
      return row;
    },
    async update(
      userId: string,
      id: string,
      values: Partial<Omit<typeof addresses.$inferInsert, 'id' | 'userId'>>,
    ) {
      return (await db.update(addresses).set(values).where(owned(userId, id)).returning())[0];
    },
    async delete(userId: string, id: string) {
      return (
        await db.delete(addresses).where(owned(userId, id)).returning({ id: addresses.id })
      )[0];
    },
  };
}
