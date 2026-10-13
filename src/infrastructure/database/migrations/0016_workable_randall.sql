CREATE TABLE "ai_usage_limits" (
	"user_id" uuid NOT NULL,
	"key_source" text NOT NULL,
	"usd_per_day" double precision,
	"usd_per_month" double precision,
	"tokens_per_day" bigint,
	"tokens_per_month" bigint,
	"updated_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_usage_limits_user_id_key_source_pk" PRIMARY KEY("user_id","key_source")
);
--> statement-breakpoint
DROP TABLE "ai_usage" CASCADE;--> statement-breakpoint
ALTER TABLE "ai_usage_limits" ADD CONSTRAINT "ai_usage_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_limits" ADD CONSTRAINT "ai_usage_limits_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;