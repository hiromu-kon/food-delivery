CREATE TABLE "delivery_photos" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"courier_id" text NOT NULL,
	"base64" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "delivery_photos_size" CHECK (length("delivery_photos"."base64") between 4 and 2796204)
);
--> statement-breakpoint
ALTER TABLE "delivery_photos" ADD CONSTRAINT "delivery_photos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_photos" ADD CONSTRAINT "delivery_photos_courier_id_users_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_photos_expiry" ON "delivery_photos" USING btree ("expires_at");