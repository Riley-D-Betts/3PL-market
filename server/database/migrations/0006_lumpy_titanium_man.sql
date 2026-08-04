ALTER TABLE "vehicles" RENAME COLUMN "odometer_km" TO "odometer_mi";--> statement-breakpoint
UPDATE "vehicles" SET "odometer_mi" = round("odometer_mi" * 0.621371) WHERE "odometer_mi" IS NOT NULL;
