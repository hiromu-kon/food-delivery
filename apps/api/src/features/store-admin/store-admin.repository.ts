import type { staffCreateSchema } from '@repo/contract';
import { accounts, stores, storeStaffMemberships, users, type Db, type Store } from '@repo/db';
import { DomainError } from '@repo/domain';
import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';

export function createStoreAdminRepository(db: Db) {
  async function scoped<T>(
    userId: string,
    action: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      const [admin] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.role, 'admin'),
            eq(users.disabled, false),
            eq(users.emailVerified, true),
          ),
        )
        .for('update');
      if (!admin) throw new DomainError('FORBIDDEN', '運営権限を確認してください');
      return action(tx);
    });
  }
  const missing = () => new DomainError('NOT_FOUND', '店舗が見つかりません');
  return {
    list(userId: string) {
      return scoped(userId, (tx) =>
        tx.select().from(stores).orderBy(asc(stores.name), asc(stores.id)),
      );
    },
    get(userId: string, id: string) {
      return scoped(userId, async (tx) => {
        const [store] = await tx.select().from(stores).where(eq(stores.id, id));
        if (!store) throw missing();
        return store;
      });
    },
    create(userId: string, input: typeof stores.$inferInsert) {
      return scoped(userId, async (tx) => {
        const [store] = await tx.insert(stores).values(input).returning();
        if (!store) throw missing();
        return store;
      });
    },
    update(userId: string, id: string, input: Partial<Omit<Store, 'id'>>) {
      return scoped(userId, async (tx) => {
        const [store] = await tx.update(stores).set(input).where(eq(stores.id, id)).returning();
        if (!store) throw missing();
        return store;
      });
    },
    delete(userId: string, id: string) {
      return scoped(userId, async (tx) => {
        const [store] = await tx.delete(stores).where(eq(stores.id, id)).returning();
        if (!store) throw missing();
      });
    },
    staff(
      userId: string,
      storeId: string,
      input: z.infer<typeof staffCreateSchema>,
      password: string,
    ) {
      return scoped(userId, async (tx) => {
        const [store] = await tx
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.id, storeId))
          .for('update');
        if (!store) throw missing();
        const id = crypto.randomUUID();
        const [staff] = await tx
          .insert(users)
          .values({
            id,
            name: input.name,
            email: input.email,
            phoneNumber: input.phoneNumber,
            role: 'store',
            emailVerified: false,
          })
          .returning();
        await tx.insert(accounts).values({
          id: crypto.randomUUID(),
          userId: id,
          accountId: id,
          providerId: 'credential',
          password,
        });
        await tx.insert(storeStaffMemberships).values({ userId: id, storeId });
        return staff;
      });
    },
  };
}
