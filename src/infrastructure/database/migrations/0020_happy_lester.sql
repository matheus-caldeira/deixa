DROP TABLE "progress_snapshots" CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_attempts" ADD COLUMN "kinds" jsonb DEFAULT '{}'::jsonb NOT NULL;