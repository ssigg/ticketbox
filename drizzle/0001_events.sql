CREATE TYPE "public"."event_status" AS ENUM('draft', 'onsale', 'closed');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"sales_start" timestamp with time zone,
	"sales_end" timestamp with time zone,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_tenant_id_slug_unique" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "timezone" text DEFAULT 'Europe/Zurich' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_tenant_id_starts_at_index" ON "events" USING btree ("tenant_id","starts_at");