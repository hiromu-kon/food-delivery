CREATE TYPE "public"."order_status" AS ENUM('pending', 'preparing', 'ready', 'delivering', 'delivered', 'canceled');--> statement-breakpoint
CREATE TABLE "checkout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"quote" jsonb NOT NULL,
	"payment_intent_id" text,
	"failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_attempts_paymentIntentId_unique" UNIQUE("payment_intent_id"),
	CONSTRAINT "checkout_attempts_user_key" UNIQUE("user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit_price" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_order_product" UNIQUE("order_id","menu_item_id"),
	CONSTRAINT "order_items_quantity" CHECK ("order_items"."quantity" between 1 and 20),
	CONSTRAINT "order_items_price" CHECK ("order_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"delivery_fee" integer DEFAULT 300 NOT NULL,
	CONSTRAINT "order_settings_singleton" CHECK ("order_settings"."id" = 1),
	CONSTRAINT "order_settings_fee" CHECK ("order_settings"."delivery_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"store_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_intent_id" text NOT NULL,
	"subtotal" integer NOT NULL,
	"delivery_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"fulfillment" text NOT NULL,
	"dropoff_location" text,
	"address" text NOT NULL,
	"building" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"delivery_note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_paymentIntentId_unique" UNIQUE("payment_intent_id"),
	CONSTRAINT "orders_totals" CHECK ("orders"."subtotal" >= 0 and "orders"."delivery_fee" >= 0 and "orders"."total" = "orders"."subtotal" + "orders"."delivery_fee"),
	CONSTRAINT "orders_fulfillment" CHECK (("orders"."fulfillment" = 'hand_delivery' and "orders"."dropoff_location" is null) or ("orders"."fulfillment" = 'leave_at_door' and "orders"."dropoff_location" is not null and "orders"."dropoff_location" in ('front_door', 'delivery_box', 'other'))),
	CONSTRAINT "orders_note_length" CHECK (char_length("orders"."delivery_note") <= 100)
);
--> statement-breakpoint
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_id_checkout_attempts_id_fk" FOREIGN KEY ("id") REFERENCES "public"."checkout_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO order_settings (id, delivery_fee) VALUES (1, 300);
