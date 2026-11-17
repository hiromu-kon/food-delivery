import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { users } from './auth';

export const deliveryPhotos = pgTable(
  'delivery_photos',
  {
    orderId: uuid()
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    courierId: text()
      .notNull()
      .references(() => users.id),
    base64: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index('delivery_photos_expiry').on(t.expiresAt),
    check('delivery_photos_size', sql`length(${t.base64}) between 4 and 2796204`),
  ],
);
export type DeliveryPhoto = typeof deliveryPhotos.$inferSelect;
