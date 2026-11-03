CREATE TYPE "public"."seat_plan_dark_mode" AS ENUM('auto', 'on', 'off');--> statement-breakpoint
ALTER TABLE "seat_plans" ADD COLUMN "dark_mode" "seat_plan_dark_mode" DEFAULT 'auto' NOT NULL;