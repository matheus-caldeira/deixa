CREATE TABLE "episode_scripts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"language" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"storage_path" text NOT NULL,
	"sha256" text NOT NULL,
	"status" text NOT NULL,
	"line_count" integer NOT NULL,
	"matched_count" integer NOT NULL,
	"cue_count" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"script_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"text" text NOT NULL,
	"matched_cue_id" uuid,
	"verified" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"attempts" integer NOT NULL,
	"max_attempts" integer NOT NULL,
	"run_after" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	"failure_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_scripts" ADD CONSTRAINT "episode_scripts_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_scripts" ADD CONSTRAINT "episode_scripts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_lines" ADD CONSTRAINT "script_lines_script_id_episode_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."episode_scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_lines" ADD CONSTRAINT "script_lines_matched_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("matched_cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_queue" ADD CONSTRAINT "job_queue_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episode_scripts_episode_language" ON "episode_scripts" USING btree ("episode_id","language");--> statement-breakpoint
CREATE INDEX "script_lines_script_sequence" ON "script_lines" USING btree ("script_id","sequence");--> statement-breakpoint
CREATE INDEX "script_lines_cue" ON "script_lines" USING btree ("matched_cue_id");--> statement-breakpoint
CREATE INDEX "job_queue_status_run_after" ON "job_queue" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "job_queue_kind_status" ON "job_queue" USING btree ("kind","status");