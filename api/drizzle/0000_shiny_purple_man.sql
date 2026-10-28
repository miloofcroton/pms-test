CREATE SCHEMA "lakeside_normal";
--> statement-breakpoint
CREATE SCHEMA "sync_audit";
--> statement-breakpoint
CREATE SCHEMA "rentlive";
--> statement-breakpoint
CREATE TABLE "lakeside_normal"."lease_customers" (
	"property_id" text NOT NULL,
	"lease_remote_id" text NOT NULL,
	"remote_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"move_in_date" date,
	"move_out_date" date,
	CONSTRAINT "lease_customers_property_id_lease_remote_id_remote_id_pk" PRIMARY KEY("property_id","lease_remote_id","remote_id")
);
--> statement-breakpoint
CREATE TABLE "lakeside_normal"."leases" (
	"property_id" text NOT NULL,
	"remote_id" text NOT NULL,
	"unit_remote_id" text NOT NULL,
	"status" text NOT NULL,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "leases_property_id_remote_id_pk" PRIMARY KEY("property_id","remote_id")
);
--> statement-breakpoint
CREATE TABLE "lakeside_normal"."properties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_audit"."change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"property_id" text NOT NULL,
	"unit_remote_id" text,
	"resident_remote_id" text,
	"kind" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_audit"."decisions" (
	"property_id" text NOT NULL,
	"unit_remote_id" text NOT NULL,
	"resident_remote_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"run_id" integer NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_property_id_unit_remote_id_resident_remote_id_pk" PRIMARY KEY("property_id","unit_remote_id","resident_remote_id")
);
--> statement-breakpoint
CREATE TABLE "sync_audit"."runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"snapshot_file" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rentlive"."residents" (
	"property_id" text NOT NULL,
	"unit_remote_id" text NOT NULL,
	"remote_id" text NOT NULL,
	"lease_remote_id" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"moved_in" boolean DEFAULT false NOT NULL,
	"ever_moved_out" boolean DEFAULT false NOT NULL,
	CONSTRAINT "residents_property_id_unit_remote_id_remote_id_pk" PRIMARY KEY("property_id","unit_remote_id","remote_id")
);
--> statement-breakpoint
CREATE TABLE "rentlive"."units" (
	"property_id" text NOT NULL,
	"remote_id" text NOT NULL,
	"unit_number" text NOT NULL,
	"building_name" text,
	"floorplan_name" text,
	"status" text NOT NULL,
	CONSTRAINT "units_property_id_remote_id_pk" PRIMARY KEY("property_id","remote_id")
);
