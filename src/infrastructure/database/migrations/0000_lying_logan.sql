CREATE TABLE "progress_snapshots" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_ai_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"key_version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"native_language" text NOT NULL,
	"daily_goal" integer NOT NULL,
	"preferred_accent" text NOT NULL,
	"audio_speed" double precision NOT NULL,
	"timezone" text NOT NULL,
	"current_episode_id" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_color" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audio_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text_hash" text NOT NULL,
	"voice_id" text NOT NULL,
	"language" text NOT NULL,
	"model_version" text NOT NULL,
	"format" text NOT NULL,
	"storage_path" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cue_alignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"en_cue_id" uuid NOT NULL,
	"pt_cue_ids" jsonb NOT NULL,
	"overlap_score" double precision NOT NULL,
	"offset_ms" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cue_translations" (
	"cue_id" uuid PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"episode_number" integer NOT NULL,
	"title" text NOT NULL,
	"overview" text NOT NULL,
	"duration_seconds" integer,
	"status" text NOT NULL,
	"failure_reason" text,
	"cue_count" integer NOT NULL,
	"alignment_pairs" integer,
	"alignment_rate" double precision,
	"uploaded_by" uuid,
	"ready_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"original_title" text NOT NULL,
	"overview" text NOT NULL,
	"year" integer,
	"metadata_provider" text NOT NULL,
	"external_id" text NOT NULL,
	"poster_path" text,
	"poster_colors" jsonb,
	"level_min" text NOT NULL,
	"level_max" text NOT NULL,
	"accent" text,
	"created_by" uuid,
	"metadata_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer NOT NULL,
	"steps" jsonb NOT NULL,
	"failure_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"media_item_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"title" text NOT NULL,
	"episode_count" integer,
	"episodes_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subtitle_cues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subtitle_file_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtitle_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"language" text NOT NULL,
	"format" text NOT NULL,
	"storage_path" text NOT NULL,
	"sha256" text NOT NULL,
	"status" text NOT NULL,
	"processing_version" integer NOT NULL,
	"original_filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_progress" (
	"user_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"status" text NOT NULL,
	"progress_percent" integer NOT NULL,
	"last_position_ms" integer,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "episode_progress_user_id_episode_id_pk" PRIMARY KEY("user_id","episode_id")
);
--> statement-breakpoint
CREATE TABLE "highlight_card_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"status" text NOT NULL,
	"share_scope" text,
	"highlights_count" integer NOT NULL,
	"cards_created" integer NOT NULL,
	"llm_calls" integer NOT NULL,
	"llm_provider" text NOT NULL,
	"draft" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highlight_stats" (
	"episode_id" uuid NOT NULL,
	"cue_id" uuid NOT NULL,
	"start_token" integer NOT NULL,
	"end_token" integer NOT NULL,
	"user_count" integer NOT NULL,
	CONSTRAINT "highlight_stats_cue_id_start_token_end_token_pk" PRIMARY KEY("cue_id","start_token","end_token")
);
--> statement-breakpoint
CREATE TABLE "learning_item_explanations" (
	"learning_item_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"translation" text NOT NULL,
	"translation_source" text NOT NULL,
	"context_translation" text,
	"context_translation_source" text,
	"pronunciation_guide" text,
	"ipa" text,
	"grammar_note" text,
	"context_note" text,
	"example_english" text,
	"example_portuguese" text,
	CONSTRAINT "learning_item_explanations_learning_item_id_locale_pk" PRIMARY KEY("learning_item_id","locale")
);
--> statement-breakpoint
CREATE TABLE "learning_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid,
	"subtitle_file_id" uuid,
	"cue_id" uuid,
	"start_token" integer,
	"end_token" integer,
	"start_ms" integer,
	"end_ms" integer,
	"source_text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"context_text" text,
	"difficulty" text NOT NULL,
	"item_type" text NOT NULL,
	"origin" text NOT NULL,
	"visibility" text NOT NULL,
	"owner_user_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_card_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"response_time_ms" integer,
	"reviewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_item_id" uuid NOT NULL,
	"source_kind" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"interval_days" double precision NOT NULL,
	"repetitions" integer NOT NULL,
	"lapses" integer NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_highlights" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"cue_id" uuid NOT NULL,
	"start_token" integer NOT NULL,
	"end_token" integer NOT NULL,
	"kind" text NOT NULL,
	"share_scope" text NOT NULL,
	"card_batch_id" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_credentials" ADD CONSTRAINT "user_ai_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_alignments" ADD CONSTRAINT "cue_alignments_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_alignments" ADD CONSTRAINT "cue_alignments_en_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("en_cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_translations" ADD CONSTRAINT "cue_translations_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_cues" ADD CONSTRAINT "subtitle_cues_subtitle_file_id_subtitle_files_id_fk" FOREIGN KEY ("subtitle_file_id") REFERENCES "public"."subtitle_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD CONSTRAINT "subtitle_files_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_files" ADD CONSTRAINT "subtitle_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_progress" ADD CONSTRAINT "episode_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_progress" ADD CONSTRAINT "episode_progress_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight_card_batches" ADD CONSTRAINT "highlight_card_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight_card_batches" ADD CONSTRAINT "highlight_card_batches_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight_stats" ADD CONSTRAINT "highlight_stats_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight_stats" ADD CONSTRAINT "highlight_stats_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_item_explanations" ADD CONSTRAINT "learning_item_explanations_learning_item_id_learning_items_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_subtitle_file_id_subtitle_files_id_fk" FOREIGN KEY ("subtitle_file_id") REFERENCES "public"."subtitle_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_learning_item_id_learning_items_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_highlights" ADD CONSTRAINT "user_highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_highlights" ADD CONSTRAINT "user_highlights_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_highlights" ADD CONSTRAINT "user_highlights_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_highlights" ADD CONSTRAINT "user_highlights_card_batch_id_highlight_card_batches_id_fk" FOREIGN KEY ("card_batch_id") REFERENCES "public"."highlight_card_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audio_assets_hash_voice" ON "audio_assets" USING btree ("text_hash","voice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cue_alignments_en_cue" ON "cue_alignments" USING btree ("en_cue_id");--> statement-breakpoint
CREATE INDEX "cue_alignments_episode" ON "cue_alignments" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_season_number" ON "episodes" USING btree ("season_id","episode_number");--> statement-breakpoint
CREATE UNIQUE INDEX "media_items_provider_external" ON "media_items" USING btree ("metadata_provider","external_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_episode" ON "processing_jobs" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_media_number" ON "seasons" USING btree ("media_item_id","season_number");--> statement-breakpoint
CREATE UNIQUE INDEX "subtitle_cues_file_sequence" ON "subtitle_cues" USING btree ("subtitle_file_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "subtitle_files_dedupe" ON "subtitle_files" USING btree ("episode_id","language","processing_version","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "subtitle_files_episode_language" ON "subtitle_files" USING btree ("episode_id","language");--> statement-breakpoint
CREATE INDEX "highlight_card_batches_user" ON "highlight_card_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learning_items_episode" ON "learning_items" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_cards_user_item" ON "user_cards" USING btree ("user_id","learning_item_id");--> statement-breakpoint
CREATE INDEX "user_cards_due" ON "user_cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_highlights_unique" ON "user_highlights" USING btree ("user_id","cue_id","start_token","end_token","kind");--> statement-breakpoint
CREATE INDEX "user_highlights_user_episode" ON "user_highlights" USING btree ("user_id","episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_dedupe" ON "xp_events" USING btree ("user_id","source","source_id");--> statement-breakpoint
CREATE INDEX "xp_events_user_created" ON "xp_events" USING btree ("user_id","created_at");