import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const stores = pgTable(
  'stores',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text().notNull().default(''),
    address: text().notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    deliveryRadiusMeters: doublePrecision().notNull().default(3000),
    minimumOrderAmount: integer().notNull().default(0),
    isAcceptingOrders: boolean().notNull().default(true),
    photoUrl: text(),
  },
  (table) => [
    check('stores_name_length', sql`char_length(${table.name}) between 1 and 100`),
    check('stores_description_length', sql`char_length(${table.description}) <= 1000`),
    check('stores_address_length', sql`char_length(${table.address}) between 1 and 200`),
    check('stores_latitude_range', sql`${table.latitude} between -90 and 90`),
    check('stores_longitude_range', sql`${table.longitude} between -180 and 180`),
    check(
      'stores_delivery_radius_range',
      sql`${table.deliveryRadiusMeters} > 0 and ${table.deliveryRadiusMeters} < 'Infinity'::float8`,
    ),
    check('stores_minimum_order_amount_range', sql`${table.minimumOrderAmount} >= 0`),
  ],
);

export type Store = typeof stores.$inferSelect;
