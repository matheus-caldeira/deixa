ALTER TABLE "conversation_sessions" ADD COLUMN "review_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD COLUMN "cards_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "corrected_text" text;