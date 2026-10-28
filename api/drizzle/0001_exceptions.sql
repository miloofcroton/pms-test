CREATE TABLE "sync"."exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"property_id" text,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"unit_remote_id" text,
	"lease_remote_id" text,
	"resident_remote_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync"."exceptions" ADD CONSTRAINT "exceptions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "sync"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exceptions_run_id_kind_index" ON "sync"."exceptions" USING btree ("run_id","kind");--> statement-breakpoint
CREATE INDEX "exceptions_property_id_unit_remote_id_resident_remote_id_index" ON "sync"."exceptions" USING btree ("property_id","unit_remote_id","resident_remote_id");