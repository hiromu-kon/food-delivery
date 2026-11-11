import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { stores } from './stores';

export const orderStatus = pgEnum('order_status', [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'canceled',
]);

// Durable before Stripe: includes the immutable pricing/fulfillment quote, never card data.
export const checkoutAttempts = pgTable(
  'checkout_attempts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id),
    idempotencyKey: uuid().notNull(),
    requestHash: text().notNull(),
    quote: jsonb().$type<CheckoutQuote>().notNull(),
    paymentIntentId: text().unique(),
    failed: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('checkout_attempts_user_key').on(t.userId, t.idempotencyKey)],
);

export type CheckoutQuote = {
  storeId: string;
  address: string;
  building: string;
  latitude: number;
  longitude: number;
  deliveryNote: string;
  fulfillment: 'hand_delivery' | 'leave_at_door';
  dropoffLocation: 'front_door' | 'delivery_box' | 'other' | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: { menuItemId: string; name: string; unitPrice: number; quantity: number }[];
};

export const orders = pgTable(
  'orders',
  {
    id: uuid()
      .primaryKey()
      .references(() => checkoutAttempts.id),
    userId: text()
      .notNull()
      .references(() => users.id),
    storeId: uuid()
      .notNull()
      .references(() => stores.id),
    status: orderStatus().notNull().default('pending'),
    paymentIntentId: text().notNull().unique(),
    cancellationReason: text().$type<'customer' | 'store_rejected' | 'expired' | 'admin'>(),
    paymentVoidedAt: timestamp({ withTimezone: true }),
    subtotal: integer().notNull(),
    deliveryFee: integer().notNull(),
    total: integer().notNull(),
    fulfillment: text().$type<CheckoutQuote['fulfillment']>().notNull(),
    dropoffLocation: text().$type<CheckoutQuote['dropoffLocation']>(),
    address: text().notNull(),
    building: text().notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    deliveryNote: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'orders_totals',
      sql`${t.subtotal} >= 0 and ${t.deliveryFee} >= 0 and ${t.total} = ${t.subtotal} + ${t.deliveryFee}`,
    ),
    check(
      'orders_fulfillment',
      sql`(${t.fulfillment} = 'hand_delivery' and ${t.dropoffLocation} is null) or (${t.fulfillment} = 'leave_at_door' and ${t.dropoffLocation} is not null and ${t.dropoffLocation} in ('front_door', 'delivery_box', 'other'))`,
    ),
    check('orders_note_length', sql`char_length(${t.deliveryNote}) <= 100`),
  ],
);
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    // Keep original ID and snapshot even if the menu item is deleted.
    menuItemId: uuid().notNull(),
    name: text().notNull(),
    unitPrice: integer().notNull(),
    quantity: integer().notNull(),
  },
  (t) => [
    unique('order_items_order_product').on(t.orderId, t.menuItemId),
    check('order_items_quantity', sql`${t.quantity} between 1 and 20`),
    check('order_items_price', sql`${t.unitPrice} >= 0`),
  ],
);

export const orderSettings = pgTable(
  'order_settings',
  {
    id: integer().primaryKey(),
    deliveryFee: integer().notNull().default(300),
  },
  (t) => [
    check('order_settings_singleton', sql`${t.id} = 1`),
    check('order_settings_fee', sql`${t.deliveryFee} >= 0`),
  ],
);
