ALTER TABLE "loads" RENAME COLUMN "weight_kg" TO "weight_lbs";--> statement-breakpoint
ALTER TABLE "vehicle_maintenance_logs" RENAME COLUMN "odometer_km" TO "odometer_mi";--> statement-breakpoint
ALTER TABLE "vehicles" RENAME COLUMN "capacity_kg" TO "capacity_lbs";--> statement-breakpoint
ALTER TABLE "loads" DROP CONSTRAINT "loads_weight_check";--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_weight_check" CHECK ("loads"."weight_lbs" > 0);--> statement-breakpoint
UPDATE "loads" SET "weight_lbs" = LEAST(2147483647, GREATEST(1, round("weight_lbs" * 2.20462)));--> statement-breakpoint
UPDATE "vehicles" SET "capacity_lbs" = LEAST(2147483647, GREATEST(1, round("capacity_lbs" * 2.20462)));--> statement-breakpoint
UPDATE "vehicle_maintenance_logs" SET "odometer_mi" = round("odometer_mi" * 0.621371) WHERE "odometer_mi" IS NOT NULL;
