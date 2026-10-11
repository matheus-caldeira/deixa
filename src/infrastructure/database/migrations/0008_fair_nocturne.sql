CREATE TABLE "ai_usage" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"calls" integer NOT NULL,
	CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD COLUMN "user_turns_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;