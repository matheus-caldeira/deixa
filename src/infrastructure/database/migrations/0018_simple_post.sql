ALTER TABLE "notifications" ADD COLUMN "params" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "locale" text DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "body";