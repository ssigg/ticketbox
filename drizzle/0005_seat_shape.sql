ALTER TABLE "seats" ADD COLUMN "width" double precision DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "height" double precision DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "rotation" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Seats placed before had the plan's seat size as diameter.
UPDATE "seats" SET "width" = p."seat_size", "height" = p."seat_size" FROM "seat_plans" p WHERE "seats"."seat_plan_id" = p."id";
