CREATE TABLE "user_language_pairs" (
	"user_id" uuid NOT NULL,
	"target_language" text NOT NULL,
	"native_language" text NOT NULL,
	"level" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_language_pairs_user_id_target_language_native_language_pk" PRIMARY KEY("user_id","target_language","native_language")
);
--> statement-breakpoint
ALTER TABLE "cue_alignments" DROP CONSTRAINT "cue_alignments_en_cue_id_subtitle_cues_id_fk";
--> statement-breakpoint
DROP INDEX "cue_alignments_en_cue";--> statement-breakpoint
DROP INDEX "lesson_plans_episode_level";--> statement-breakpoint
ALTER TABLE "cue_translations" DROP CONSTRAINT "cue_translations_pkey";--> statement-breakpoint
ALTER TABLE "cue_translations" ADD CONSTRAINT "cue_translations_cue_id_locale_pk" PRIMARY KEY("cue_id","locale");--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "target_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "cue_alignments" RENAME COLUMN "en_cue_id" TO "source_cue_id";--> statement-breakpoint
ALTER TABLE "cue_alignments" RENAME COLUMN "pt_cue_ids" TO "aligned_cue_ids";--> statement-breakpoint
ALTER TABLE "cue_alignments" ADD COLUMN "target_language" text DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "original_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_items" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_attempts" ADD COLUMN "language_pair" text DEFAULT 'en>pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD COLUMN "language_pair" text DEFAULT 'en>pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_language_pairs" ADD CONSTRAINT "user_language_pairs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_alignments" ADD CONSTRAINT "cue_alignments_source_cue_id_subtitle_cues_id_fk" FOREIGN KEY ("source_cue_id") REFERENCES "public"."subtitle_cues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cue_alignments_source_language" ON "cue_alignments" USING btree ("source_cue_id","target_language");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_plans_episode_pair_level" ON "lesson_plans" USING btree ("episode_id","language_pair","level");--> statement-breakpoint
INSERT INTO "user_language_pairs" ("user_id", "target_language", "native_language", "level", "created_at")
SELECT "user_id", 'en', "native_language", "level", now() FROM "user_preferences" ON CONFLICT DO NOTHING;
