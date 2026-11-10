import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { stores } from './stores';

// 認証プロバイダの accounts と所属を分離し、1 人 1 店舗を主キーで保証する。
export const storeStaffMemberships = pgTable(
  'store_staff_memberships',
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    storeId: uuid()
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
  },
  (table) => [index('store_staff_memberships_store_id_idx').on(table.storeId)],
);
