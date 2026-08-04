CREATE TABLE "driver_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"start_odometer_mi" integer NOT NULL,
	"pretrip" jsonb NOT NULL,
	"pretrip_defects" text,
	"ended_at" timestamp with time zone,
	"end_odometer_mi" integer,
	"fuel_gallons" double precision,
	CONSTRAINT "driver_shifts_start_odometer_check" CHECK ("driver_shifts"."start_odometer_mi" >= 0),
	CONSTRAINT "driver_shifts_end_odometer_check" CHECK ("driver_shifts"."end_odometer_mi" IS NULL OR "driver_shifts"."end_odometer_mi" >= "driver_shifts"."start_odometer_mi"),
	CONSTRAINT "driver_shifts_fuel_check" CHECK ("driver_shifts"."fuel_gallons" IS NULL OR "driver_shifts"."fuel_gallons" >= 0),
	CONSTRAINT "driver_shifts_ended_check" CHECK ((("driver_shifts"."ended_at" IS NULL) = ("driver_shifts"."end_odometer_mi" IS NULL)) AND (("driver_shifts"."ended_at" IS NULL) = ("driver_shifts"."fuel_gallons" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "load_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" uuid NOT NULL,
	"kind" text DEFAULT 'ticket' NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"content_type" text NOT NULL,
	"filename" text,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "delivered_tons" double precision;--> statement-breakpoint
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_attachments" ADD CONSTRAINT "load_attachments_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_attachments" ADD CONSTRAINT "load_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_shifts_active_unique" ON "driver_shifts" USING btree ("driver_id") WHERE "driver_shifts"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "driver_shifts_company_idx" ON "driver_shifts" USING btree ("company_id","started_at");--> statement-breakpoint
CREATE INDEX "load_attachments_load_idx" ON "load_attachments" USING btree ("load_id");