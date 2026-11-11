import { categoryResponseSchema, itemResponseSchema, managedMenuSchema } from '@repo/contract';
import type { Db } from '@repo/db';

import { createMenuManagementRepository } from './menu-management.repository';

export function createMenuManagementService(db: Db) {
  const repository = createMenuManagementRepository(db);
  return {
    async get(...args: Parameters<typeof repository.get>) {
      const { categories, items } = await repository.get(...args);
      const grouped = new Map<string, typeof items>();
      for (const item of items) {
        const group = grouped.get(item.categoryId) ?? [];
        group.push(item);
        grouped.set(item.categoryId, group);
      }
      return managedMenuSchema.parse({
        categories: categories.map((category) => ({
          ...category,
          items: grouped.get(category.id) ?? [],
        })),
      });
    },
    async getCategory(...args: Parameters<typeof repository.getCategory>) {
      return categoryResponseSchema.parse({ category: await repository.getCategory(...args) });
    },
    async createCategory(...args: Parameters<typeof repository.createCategory>) {
      return categoryResponseSchema.parse({ category: await repository.createCategory(...args) });
    },
    async updateCategory(...args: Parameters<typeof repository.updateCategory>) {
      return categoryResponseSchema.parse({ category: await repository.updateCategory(...args) });
    },
    async deleteCategory(...args: Parameters<typeof repository.deleteCategory>) {
      await repository.deleteCategory(...args);
    },
    async getItem(...args: Parameters<typeof repository.getItem>) {
      return itemResponseSchema.parse({ item: await repository.getItem(...args) });
    },
    async createItem(...args: Parameters<typeof repository.createItem>) {
      return itemResponseSchema.parse({ item: await repository.createItem(...args) });
    },
    async updateItem(...args: Parameters<typeof repository.updateItem>) {
      return itemResponseSchema.parse({ item: await repository.updateItem(...args) });
    },
    async deleteItem(...args: Parameters<typeof repository.deleteItem>) {
      await repository.deleteItem(...args);
    },
  };
}
