ALTER TABLE "lakeside"."snapshots" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lakeside"."snapshots" ALTER COLUMN "generated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync"."exceptions" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sync"."runs" ALTER COLUMN "snapshot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync"."runs" ALTER COLUMN "counts" SET DEFAULT '{"unitsUpserted":0,"residentsUpserted":0,"movedIn":0,"movedOut":0,"skipped":0,"flagged":0}'::jsonb;--> statement-breakpoint
ALTER TABLE "sync"."runs" ADD COLUMN "source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sync"."runs" ADD COLUMN "status" text DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync"."runs" ADD COLUMN "error" jsonb;--> statement-breakpoint
ALTER TABLE "sync"."change_log" ADD CONSTRAINT "change_log_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "sync"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync"."decisions" ADD CONSTRAINT "decisions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "sync"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_log_property_id_unit_remote_id_resident_remote_id_index" ON "sync"."change_log" USING btree ("property_id","unit_remote_id","resident_remote_id");--> statement-breakpoint
ALTER TABLE "sync"."exceptions" DROP COLUMN "details";