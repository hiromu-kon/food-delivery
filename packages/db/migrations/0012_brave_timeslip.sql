CREATE UNIQUE INDEX "orders_one_active_per_courier" ON "orders" USING btree ("courier_id") WHERE "orders"."status" in ('preparing', 'ready', 'delivering');
