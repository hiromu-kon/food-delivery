import type {
  categoryCreateSchema,
  categoryUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
} from '@repo/contract';
import { menuCategories, menuItems, storeStaffMemberships, users, type Db } from '@repo/db';
import { DomainError } from '@repo/domain';
import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';

export function createMenuManagementRepository(db: Db) {
  async function scoped<T>(
    userId: string,
    storeId: string,
    action: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      const [member] = await tx
        .select({ id: users.id })
        .from(users)
        .innerJoin(storeStaffMemberships, eq(storeStaffMemberships.userId, users.id))
        .where(
          and(
            eq(users.id, userId),
            eq(users.role, 'store'),
            eq(users.disabled, false),
            eq(users.emailVerified, true),
            eq(storeStaffMemberships.storeId, storeId),
          ),
        )
        .for('update');
      if (!member) throw new DomainError('FORBIDDEN', 'この操作はできません');
      return action(tx);
    });
  }
  return {
    get(userId: string, storeId: string) {
      return scoped(userId, storeId, async (tx) => {
        const categories = await tx
          .select()
          .from(menuCategories)
          .where(eq(menuCategories.storeId, storeId))
          .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.id));
        const items = await tx
          .select()
          .from(menuItems)
          .where(eq(menuItems.storeId, storeId))
          .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
        return { categories, items };
      });
    },
    getCategory(userId: string, storeId: string, id: string) {
      return scoped(userId, storeId, async (tx) => {
        const [row] = await tx
          .select()
          .from(menuCategories)
          .where(and(eq(menuCategories.storeId, storeId), eq(menuCategories.id, id)));
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return row;
      });
    },
    createCategory(userId: string, storeId: string, input: z.infer<typeof categoryCreateSchema>) {
      return scoped(userId, storeId, async (tx) => {
        const [row] = await tx
          .insert(menuCategories)
          .values({ ...input, storeId })
          .returning();
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return row;
      });
    },
    updateCategory(
      userId: string,
      storeId: string,
      id: string,
      input: z.infer<typeof categoryUpdateSchema>,
    ) {
      return scoped(userId, storeId, async (tx) => {
        const [row] = await tx
          .update(menuCategories)
          .set(input)
          .where(and(eq(menuCategories.storeId, storeId), eq(menuCategories.id, id)))
          .returning();
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return row;
      });
    },
    deleteCategory(userId: string, storeId: string, id: string) {
      return scoped(userId, storeId, async (tx) => {
        const [row] = await tx
          .delete(menuCategories)
          .where(and(eq(menuCategories.storeId, storeId), eq(menuCategories.id, id)))
          .returning();
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return;
      });
    },
    getItem(userId: string, storeId: string, id: string) {
      return scoped(userId, storeId, async (tx) => {
        const [row] = await tx
          .select()
          .from(menuItems)
          .where(and(eq(menuItems.storeId, storeId), eq(menuItems.id, id)));
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return row;
      });
    },
    createItem(userId: string, storeId: string, input: z.infer<typeof itemCreateSchema>) {
      return scoped(userId, storeId, async (tx) => {
        if (input.categoryId !== undefined) {
          const [category] = await tx
            .select({ id: menuCategories.id })
            .from(menuCategories)
            .where(
              and(eq(menuCategories.storeId, storeId), eq(menuCategories.id, input.categoryId)),
            )
            .for('update');
          if (!category) throw new DomainError('NOT_FOUND', 'カテゴリが見つかりません');
        }
        const [row] = await tx
          .insert(menuItems)
          .values({ ...input, storeId })
          .returning();
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return row;
      });
    },
    updateItem(
      userId: string,
      storeId: string,
      id: string,
      input: z.infer<typeof itemUpdateSchema>,
    ) {
      return scoped(userId, storeId, async (tx) => {
        if (input.categoryId !== undefined) {
          const [category] = await tx
            .select({ id: menuCategories.id })
            .from(menuCategories)
            .where(
              and(eq(menuCategories.storeId, storeId), eq(menuCategories.id, input.categoryId)),
            )
            .for('update');
          if (!category) throw new DomainError('NOT_FOUND', 'カテゴリが見つかりません');
        }
        const [row] = await tx
          .update(menuItems)
          .set(input)
          .where(and(eq(menuItems.storeId, storeId), eq(menuItems.id, id)))
          .returning();
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return row;
      });
    },
    deleteItem(userId: string, storeId: string, id: string) {
      return scoped(userId, storeId, async (tx) => {
        const [row] = await tx
          .delete(menuItems)
          .where(and(eq(menuItems.storeId, storeId), eq(menuItems.id, id)))
          .returning();
        if (!row) throw new DomainError('NOT_FOUND', 'メニューが見つかりません');
        return;
      });
    },
  };
}
