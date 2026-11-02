import { sql } from 'drizzle-orm';
import { check, doublePrecision, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const addresses = pgTable(
  'addresses',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    address: text().notNull(),
    building: text().notNull().default(''),
    deliveryNote: text().notNull().default(''),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
  },
  (table) => [
    index('addresses_user_id_idx').on(table.userId),
    check('addresses_address_length', sql`char_length(${table.address}) between 1 and 200`),
    check('addresses_building_length', sql`char_length(${table.building}) <= 100`),
    check('addresses_delivery_note_length', sql`char_length(${table.deliveryNote}) <= 100`),
    check('addresses_latitude_range', sql`${table.latitude} between -90 and 90`),
    check('addresses_longitude_range', sql`${table.longitude} between -180 and 180`),
  ],
);

export type Address = typeof addresses.$inferSelect;
