ALTER TABLE "user_ai_models" ADD COLUMN "assigned_generation" jsonb;--> statement-breakpoint
ALTER TABLE "user_ai_models" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
ALTER TABLE "user_ai_models" ADD CONSTRAINT "user_ai_models_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;