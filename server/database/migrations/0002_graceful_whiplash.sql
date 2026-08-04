ALTER TYPE "public"."load_event_type" ADD VALUE 'arrived_pickup';--> statement-breakpoint
ALTER TYPE "public"."load_event_type" ADD VALUE 'arrived_delivery';--> statement-breakpoint
CREATE TABLE "shipper_carrier_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "detention_free_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "detention_rate_per_hour_cents" integer DEFAULT 7500 NOT NULL;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "pickup_contact_name" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "pickup_contact_phone" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "delivery_contact_name" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "delivery_contact_phone" text;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "detention_free_minutes" integer;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "detention_rate_per_hour_cents" integer;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "arrived_pickup_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "arrived_delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "pickup_detention_cents" integer;--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "delivery_detention_cents" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "shipper_carrier_blocks" ADD CONSTRAINT "shipper_carrier_blocks_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_carrier_blocks" ADD CONSTRAINT "shipper_carrier_blocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipper_carrier_blocks_pair_unique" ON "shipper_carrier_blocks" USING btree ("shipper_id","company_id");--> statement-breakpoint
CREATE INDEX "shipper_carrier_blocks_company_idx" ON "shipper_carrier_blocks" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_detention_free_check" CHECK ("bids"."detention_free_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_detention_rate_check" CHECK ("bids"."detention_rate_per_hour_cents" >= 0);