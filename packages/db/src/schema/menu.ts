import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { stores } from './stores';

export const menuCategories = pgTable(
  'menu_categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    storeId: uuid()
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    photoUrl: text(),
    sortOrder: integer().notNull().default(0),
  },
  (table) => [
    unique('menu_categories_store_id_id_unique').on(table.storeId, table.id),
    index('menu_categories_store_order_idx').on(table.storeId, table.sortOrder, table.id),
    check('menu_categories_name_length', sql`char_length(${table.name}) between 1 and 100`),
    check('menu_categories_description_length', sql`char_length(${table.description}) <= 1000`),
    check('menu_categories_sort_order_range', sql`${table.sortOrder} >= 0`),
  ],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    storeId: uuid()
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    categoryId: uuid().notNull(),
    name: text().notNull(),
    description: text().notNull().default(''),
    price: integer().notNull(),
    photoUrl: text(),
    soldout: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
  },
  (table) => [
    foreignKey({
      name: 'menu_items_store_category_fk',
      columns: [table.storeId, table.categoryId],
      foreignColumns: [menuCategories.storeId, menuCategories.id],
    }).onDelete('cascade'),
    index('menu_items_store_category_order_idx').on(
      table.storeId,
      table.categoryId,
      table.sortOrder,
      table.id,
    ),
    check('menu_items_name_length', sql`char_length(${table.name}) between 1 and 100`),
    check('menu_items_description_length', sql`char_length(${table.description}) <= 1000`),
    check('menu_items_price_range', sql`${table.price} >= 0`),
    check('menu_items_sort_order_range', sql`${table.sortOrder} >= 0`),
  ],
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
