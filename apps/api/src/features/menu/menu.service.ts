import { menuResponseSchema, type MenuResponse } from '@repo/contract';
import type { Db } from '@repo/db';
import { DomainError } from '@repo/domain';

import { createMenuRepository } from './menu.repository';

export function createMenuService(db: Db) {
  const repository = createMenuRepository(db);
  return {
    async get(storeId: string) {
      const store = await repository.findStore(storeId);
      if (!store) throw new DomainError('NOT_FOUND', '店舗が見つかりません');
      const [categories, items] = await Promise.all([
        repository.categories(storeId),
        repository.items(storeId),
      ]);
      const byCategory = new Map<string, MenuResponse['categories'][number]['items']>();
      for (const item of items) {
        const group = byCategory.get(item.categoryId) ?? [];
        group.push(item);
        byCategory.set(item.categoryId, group);
      }
      // 公開項目をschemaで限定し、保存モデルの追加項目を漏らさない。
      return menuResponseSchema.parse({
        store,
        categories: categories.map((category) => ({
          ...category,
          items: byCategory.get(category.id) ?? [],
        })),
      });
    },
  };
}
