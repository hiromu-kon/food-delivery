CREATE TABLE "store_staff_memberships" (
	"user_id" text PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_staff_memberships" ADD CONSTRAINT "store_staff_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_staff_memberships" ADD CONSTRAINT "store_staff_memberships_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_staff_memberships_store_id_idx" ON "store_staff_memberships" USING btree ("store_id");