import { menuCategories, menuItems, stores, type Db } from '@repo/db';
import { asc, eq } from 'drizzle-orm';

export function createMenuRepository(db: Db) {
  return {
    async findStore(storeId: string) {
      return (await db.select().from(stores).where(eq(stores.id, storeId)).limit(1))[0];
    },
    categories: (storeId: string) =>
      db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.storeId, storeId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.id)),
    items: (storeId: string) =>
      db
        .select()
        .from(menuItems)
        .where(eq(menuItems.storeId, storeId))
        .orderBy(asc(menuItems.categoryId), asc(menuItems.sortOrder), asc(menuItems.id)),
  };
}
