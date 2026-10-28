CREATE SCHEMA "lakeside";
--> statement-breakpoint
CREATE SCHEMA "rentlive";
--> statement-breakpoint
CREATE SCHEMA "sync";
--> statement-breakpoint
CREATE TABLE "lakeside"."snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"source" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body" jsonb NOT NULL
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
--> statement-breakpoint
CREATE TABLE "sync"."change_log" (
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
CREATE TABLE "sync"."decisions" (
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
CREATE TABLE "sync"."runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync"."runs" ADD CONSTRAINT "runs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "lakeside"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_property_id_generated_at_index" ON "lakeside"."snapshots" USING btree ("property_id","generated_at");