CREATE TABLE "recommendation_history" (
	"user_id" uuid NOT NULL,
	"work_key" text NOT NULL,
	"first_suggested_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recommendation_history_user_id_work_key_pk" PRIMARY KEY("user_id","work_key")
);
--> statement-breakpoint
ALTER TABLE "recommendation_history" ADD CONSTRAINT "recommendation_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "recommendation_history" ("user_id", "work_key", "first_suggested_at")
SELECT "user_id", "work_key", "created_at" FROM "user_recommendations"
UNION ALL
SELECT "user_id", "work_key", "created_at" FROM "recommendation_feedback"
ON CONFLICT DO NOTHING;
