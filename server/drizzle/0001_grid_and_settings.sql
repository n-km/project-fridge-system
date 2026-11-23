CREATE TYPE "public"."appliance_layout" AS ENUM('upright', 'chest');--> statement-breakpoint
CREATE TYPE "public"."compartment_kind" AS ENUM('shelf', 'drawer', 'door', 'basket', 'bottle');--> statement-breakpoint
CREATE TABLE "household_settings" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appliances" ADD COLUMN "layout" "appliance_layout" DEFAULT 'upright' NOT NULL;--> statement-breakpoint
ALTER TABLE "compartments" ADD COLUMN "kind" "compartment_kind" DEFAULT 'shelf' NOT NULL;--> statement-breakpoint
ALTER TABLE "compartments" ADD COLUMN "zone" "appliance_type";--> statement-breakpoint
ALTER TABLE "compartments" ADD COLUMN "grid_cols" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "compartments" ADD COLUMN "grid_rows" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "compartments" ADD COLUMN "max_stack" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "compartments" ADD COLUMN "height" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "grid_x" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "grid_y" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "grid_w" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "grid_h" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "stack_level" integer;--> statement-breakpoint
ALTER TABLE "presets" ADD COLUMN "grid_w" integer;--> statement-breakpoint
ALTER TABLE "presets" ADD COLUMN "grid_h" integer;--> statement-breakpoint
ALTER TABLE "household_settings" ADD CONSTRAINT "household_settings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Bestehende Standard-Fächer passend einordnen
UPDATE "compartments" SET "kind" = 'drawer', "grid_cols" = 6, "grid_rows" = 2, "max_stack" = 2 WHERE "name" ILIKE '%gemüsefach%';--> statement-breakpoint
UPDATE "compartments" SET "kind" = 'door', "grid_cols" = 6, "grid_rows" = 1, "max_stack" = 1, "height" = 1 WHERE "name" ILIKE 'tür%';--> statement-breakpoint
UPDATE "compartments" SET "kind" = 'drawer', "grid_cols" = 5, "grid_rows" = 3, "max_stack" = 3 WHERE "name" ILIKE 'schublade%';
