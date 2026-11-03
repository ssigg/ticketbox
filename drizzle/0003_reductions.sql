CREATE TYPE "public"."reduction_kind" AS ENUM('percent', 'absolute');--> statement-breakpoint
CREATE TABLE "reduction_categories" (
	"reduction_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "reduction_categories_reduction_id_category_id_pk" PRIMARY KEY("reduction_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "reductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"kind" "reduction_kind" NOT NULL,
	"value" integer NOT NULL,
	"all_categories" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reductions_value_positive" CHECK ("reductions"."value" > 0),
	CONSTRAINT "reductions_percent_max" CHECK ("reductions"."kind" <> 'percent' or "reductions"."value" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "reduction_categories" ADD CONSTRAINT "reduction_categories_reduction_id_reductions_id_fk" FOREIGN KEY ("reduction_id") REFERENCES "public"."reductions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reduction_categories" ADD CONSTRAINT "reduction_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reductions_event_id_index" ON "reductions" USING btree ("event_id");