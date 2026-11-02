CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"building" text DEFAULT '' NOT NULL,
	"delivery_note" text DEFAULT '' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	CONSTRAINT "addresses_address_length" CHECK (char_length("addresses"."address") between 1 and 200),
	CONSTRAINT "addresses_building_length" CHECK (char_length("addresses"."building") <= 100),
	CONSTRAINT "addresses_delivery_note_length" CHECK (char_length("addresses"."delivery_note") <= 100),
	CONSTRAINT "addresses_latitude_range" CHECK ("addresses"."latitude" between -90 and 90),
	CONSTRAINT "addresses_longitude_range" CHECK ("addresses"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_id_idx" ON "addresses" USING btree ("user_id");