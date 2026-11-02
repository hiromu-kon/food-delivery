CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"delivery_radius_meters" double precision DEFAULT 3000 NOT NULL,
	"minimum_order_amount" integer DEFAULT 0 NOT NULL,
	"is_accepting_orders" boolean DEFAULT true NOT NULL,
	"photo_url" text,
	CONSTRAINT "stores_name_length" CHECK (char_length("stores"."name") between 1 and 100),
	CONSTRAINT "stores_description_length" CHECK (char_length("stores"."description") <= 1000),
	CONSTRAINT "stores_address_length" CHECK (char_length("stores"."address") between 1 and 200),
	CONSTRAINT "stores_latitude_range" CHECK ("stores"."latitude" between -90 and 90),
	CONSTRAINT "stores_longitude_range" CHECK ("stores"."longitude" between -180 and 180),
	CONSTRAINT "stores_delivery_radius_range" CHECK ("stores"."delivery_radius_meters" > 0 and "stores"."delivery_radius_meters" < 'Infinity'::float8),
	CONSTRAINT "stores_minimum_order_amount_range" CHECK ("stores"."minimum_order_amount" >= 0)
);
