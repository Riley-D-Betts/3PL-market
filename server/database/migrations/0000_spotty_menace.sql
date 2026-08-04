CREATE TYPE "public"."bid_status" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('pending', 'approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."load_event_type" AS ENUM('created', 'posted', 'unposted', 'bid_placed', 'bid_withdrawn', 'awarded', 'driver_assigned', 'picked_up', 'delivered', 'completed', 'cancelled', 'note');--> statement-breakpoint
CREATE TYPE "public"."load_status" AS ENUM('draft', 'posted', 'awarded', 'picked_up', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('aggregate', 'sand', 'gravel', 'concrete', 'lumber', 'steel', 'brick_block', 'drywall', 'pipe', 'equipment', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'shipper', 'carrier_admin', 'driver');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('flatbed', 'dump_truck', 'box_truck', 'lowboy', 'tanker', 'mixer', 'other');--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"status" "bid_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_amount_check" CHECK ("bids"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"mc_number" text,
	"address" text,
	"status" "company_status" DEFAULT 'pending' NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "load_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"load_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" "load_event_type" NOT NULL,
	"from_status" "load_status",
	"to_status" "load_status",
	"payload" jsonb,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" uuid NOT NULL,
	"pickup_address" text NOT NULL,
	"pickup_city" text NOT NULL,
	"pickup_state" text NOT NULL,
	"pickup_lat" double precision,
	"pickup_lng" double precision,
	"delivery_address" text NOT NULL,
	"delivery_city" text NOT NULL,
	"delivery_state" text NOT NULL,
	"delivery_lat" double precision,
	"delivery_lng" double precision,
	"material_type" "material_type" NOT NULL,
	"material_description" text,
	"weight_kg" integer NOT NULL,
	"quantity" text,
	"pickup_window_start" timestamp with time zone NOT NULL,
	"pickup_window_end" timestamp with time zone NOT NULL,
	"asking_price_cents" integer NOT NULL,
	"final_price_cents" integer,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "load_status" DEFAULT 'draft' NOT NULL,
	"awarded_bid_id" uuid,
	"assigned_company_id" uuid,
	"assigned_driver_id" uuid,
	"assigned_vehicle_id" uuid,
	"posted_at" timestamp with time zone,
	"awarded_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loads_pickup_window_check" CHECK ("loads"."pickup_window_start" <= "loads"."pickup_window_end"),
	CONSTRAINT "loads_asking_price_check" CHECK ("loads"."asking_price_cents" > 0),
	CONSTRAINT "loads_weight_check" CHECK ("loads"."weight_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" "user_role" NOT NULL,
	"company_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_company_role_check" CHECK (("users"."role" IN ('carrier_admin', 'driver')) = ("users"."company_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"plate" text NOT NULL,
	"capacity_kg" integer NOT NULL,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_events" ADD CONSTRAINT "load_events_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_events" ADD CONSTRAINT "load_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_awarded_bid_id_bids_id_fk" FOREIGN KEY ("awarded_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_assigned_company_id_companies_id_fk" FOREIGN KEY ("assigned_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_assigned_driver_id_users_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_assigned_vehicle_id_vehicles_id_fk" FOREIGN KEY ("assigned_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bids_live_per_company_unique" ON "bids" USING btree ("load_id","company_id") WHERE "bids"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "bids_load_idx" ON "bids" USING btree ("load_id");--> statement-breakpoint
CREATE INDEX "bids_company_idx" ON "bids" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "load_events_load_seq_idx" ON "load_events" USING btree ("load_id","seq");--> statement-breakpoint
CREATE INDEX "loads_status_pickup_idx" ON "loads" USING btree ("status","pickup_window_start");--> statement-breakpoint
CREATE INDEX "loads_shipper_idx" ON "loads" USING btree ("shipper_id");--> statement-breakpoint
CREATE INDEX "loads_assigned_company_idx" ON "loads" USING btree ("assigned_company_id");--> statement-breakpoint
CREATE INDEX "loads_assigned_driver_idx" ON "loads" USING btree ("assigned_driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_company_id_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_company_plate_unique" ON "vehicles" USING btree ("company_id","plate");