ALTER TYPE "public"."load_event_type" ADD VALUE 'invoiced';--> statement-breakpoint
CREATE TABLE "route_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"duration_sec" integer,
	"distance_meters" integer,
	"geometry" jsonb,
	"found" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loads" ADD COLUMN "invoiced_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "route_cache_key_unique" ON "route_cache" USING btree ("key");