CREATE TABLE "ai_level_ratings" (
	"external_id" text PRIMARY KEY NOT NULL,
	"level_min" text NOT NULL,
	"level_max" text NOT NULL,
	"reason" text NOT NULL,
	"model" text NOT NULL,
	"rated_by" uuid,
	"rated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_level_ratings" ADD CONSTRAINT "ai_level_ratings_rated_by_users_id_fk" FOREIGN KEY ("rated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;