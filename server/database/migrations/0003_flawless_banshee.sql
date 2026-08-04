CREATE TABLE "geocode_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"found" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_base_city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_base_state" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_base_lat" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_base_lng" double precision;--> statement-breakpoint
CREATE UNIQUE INDEX "geocode_cache_query_unique" ON "geocode_cache" USING btree ("query");