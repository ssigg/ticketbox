CREATE TABLE "event_seats" (
	"event_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "event_seats_event_id_seat_id_pk" PRIMARY KEY("event_id","seat_id")
);
--> statement-breakpoint
CREATE TABLE "seat_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image" "bytea" NOT NULL,
	"image_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"seat_size" integer DEFAULT 16 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seat_plan_id" uuid NOT NULL,
	"section" text DEFAULT '' NOT NULL,
	"row" text DEFAULT '' NOT NULL,
	"number" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	CONSTRAINT "seats_seat_plan_id_section_row_number_unique" UNIQUE("seat_plan_id","section","row","number") DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "seat_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_plans" ADD CONSTRAINT "seat_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_seat_plan_id_seat_plans_id_fk" FOREIGN KEY ("seat_plan_id") REFERENCES "public"."seat_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seats_seat_plan_id_index" ON "seats" USING btree ("seat_plan_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_seat_plan_id_seat_plans_id_fk" FOREIGN KEY ("seat_plan_id") REFERENCES "public"."seat_plans"("id") ON DELETE restrict ON UPDATE no action;