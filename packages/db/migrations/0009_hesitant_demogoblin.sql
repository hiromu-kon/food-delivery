CREATE TABLE "couriers" (
	"user_id" text PRIMARY KEY NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "couriers" ADD CONSTRAINT "couriers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;