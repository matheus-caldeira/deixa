CREATE TABLE "user_ai_models" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"models" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ai_models" ADD CONSTRAINT "user_ai_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;