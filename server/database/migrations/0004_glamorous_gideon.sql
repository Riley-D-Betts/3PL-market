CREATE TYPE "public"."load_source" AS ENUM('marketplace', 'manual');--> statement-breakpoint
CREATE TABLE "vehicle_maintenance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"performed_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"cost_cents" integer,
	"odometer_km" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loads" ALTER COLUMN "shipper_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "load_number" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "source" "load_source" DEFAULT 'marketplace' NOT NULL;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "external_shipper_name" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "external_shipper_phone" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "insurance_policy" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "insurance_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "next_service_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "odometer_km" integer;--> statement-breakpoint
ALTER TABLE "vehicle_maintenance_logs" ADD CONSTRAINT "vehicle_maintenance_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_maintenance_vehicle_idx" ON "vehicle_maintenance_logs" USING btree ("vehicle_id","performed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loads_load_number_unique" ON "loads" USING btree ("load_number");--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_manual_shipper_check" CHECK (("loads"."source" = 'manual') = ("loads"."shipper_id" IS NULL));