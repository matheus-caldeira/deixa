CREATE TABLE "external_api_quota" (
	"provider" text PRIMARY KEY NOT NULL,
	"remaining" integer NOT NULL,
	"reset_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtitle_search_cache" (
	"episode_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"languages" text NOT NULL,
	"results_json" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD COLUMN "source" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD COLUMN "external_file_id" text;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD COLUMN "release_name" text;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD COLUMN "source_author" text;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD COLUMN "hearing_impaired" boolean;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD COLUMN "fps" double precision;--> statement-breakpoint
ALTER TABLE "subtitle_search_cache" ADD CONSTRAINT "subtitle_search_cache_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subtitle_files_external" ON "subtitle_files" USING btree ("source","external_file_id") WHERE "subtitle_files"."external_file_id" is not null;