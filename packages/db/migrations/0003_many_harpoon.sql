CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "menu_categories_store_id_id_unique" UNIQUE("store_id","id"),
	CONSTRAINT "menu_categories_name_length" CHECK (char_length("menu_categories"."name") between 1 and 100),
	CONSTRAINT "menu_categories_description_length" CHECK (char_length("menu_categories"."description") <= 1000),
	CONSTRAINT "menu_categories_sort_order_range" CHECK ("menu_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"photo_url" text,
	"soldout" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "menu_items_name_length" CHECK (char_length("menu_items"."name") between 1 and 100),
	CONSTRAINT "menu_items_description_length" CHECK (char_length("menu_items"."description") <= 1000),
	CONSTRAINT "menu_items_price_range" CHECK ("menu_items"."price" >= 0),
	CONSTRAINT "menu_items_sort_order_range" CHECK ("menu_items"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_store_category_fk" FOREIGN KEY ("store_id","category_id") REFERENCES "public"."menu_categories"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_categories_store_order_idx" ON "menu_categories" USING btree ("store_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "menu_items_store_category_order_idx" ON "menu_items" USING btree ("store_id","category_id","sort_order","id");