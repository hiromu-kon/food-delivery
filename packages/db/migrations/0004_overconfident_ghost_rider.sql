ALTER TABLE "addresses" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_user_default_idx" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default";--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_label_length" CHECK (char_length("addresses"."label") <= 20);