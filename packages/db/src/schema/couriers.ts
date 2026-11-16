import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const couriers = pgTable('couriers', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  isAvailable: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Courier = typeof couriers.$inferSelect;
