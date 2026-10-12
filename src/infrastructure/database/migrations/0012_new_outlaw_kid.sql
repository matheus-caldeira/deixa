CREATE TABLE "recommendation_feedback" (
	"user_id" uuid NOT NULL,
	"work_key" text NOT NULL,
	"verdict" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recommendation_feedback_user_id_work_key_pk" PRIMARY KEY("user_id","work_key")
);
--> statement-breakpoint
CREATE TABLE "recommendation_runs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"fingerprint" text,
	"writer" text,
	"embedding" text,
	"insight" text,
	"failure_reason" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_recommendations" (
	"user_id" uuid NOT NULL,
	"work_key" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"original_title" text NOT NULL,
	"overview" text NOT NULL,
	"year" integer,
	"poster_path" text,
	"genres" jsonb NOT NULL,
	"level_min" text NOT NULL,
	"level_max" text NOT NULL,
	"score" double precision NOT NULL,
	"reason" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_recommendations_user_id_work_key_pk" PRIMARY KEY("user_id","work_key")
);
--> statement-breakpoint
CREATE TABLE "work_embeddings" (
	"work_key" text NOT NULL,
	"model" text NOT NULL,
	"vector" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "work_embeddings_work_key_model_pk" PRIMARY KEY("work_key","model")
);
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;