ALTER TABLE "loads" DROP CONSTRAINT "loads_asking_price_check";--> statement-breakpoint
ALTER TABLE "loads" ALTER COLUMN "asking_price_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "pickup_location_name" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "job_name" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "travel_time_allowance_min" integer;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "truck_group_id" uuid;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "truck_seq" integer;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "trucks_total" integer;--> statement-breakpoint
CREATE INDEX "loads_truck_group_idx" ON "loads" USING btree ("truck_group_id");--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_truck_group_check" CHECK (("loads"."truck_group_id" IS NULL) = ("loads"."truck_seq" IS NULL) AND ("loads"."truck_group_id" IS NULL) = ("loads"."trucks_total" IS NULL));--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_asking_price_check" CHECK (("loads"."asking_price_cents" IS NULL OR "loads"."asking_price_cents" > 0) AND ("loads"."asking_price_cents" IS NOT NULL OR "loads"."source" = 'manual'));