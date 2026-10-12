CREATE TABLE "app_credentials" (
	"provider" text PRIMARY KEY NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"key_version" integer NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ai_credentials" DROP CONSTRAINT "user_ai_credentials_pkey";--> statement-breakpoint
UPDATE "user_ai_credentials" SET "provider" = 'gemini' WHERE "provider" = 'google-gemini';--> statement-breakpoint
ALTER TABLE "user_ai_credentials" ADD CONSTRAINT "user_ai_credentials_user_id_provider_pk" PRIMARY KEY("user_id","provider");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_admin" = true WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at", "email" LIMIT 1);--> statement-breakpoint
ALTER TABLE "app_credentials" ADD CONSTRAINT "app_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
