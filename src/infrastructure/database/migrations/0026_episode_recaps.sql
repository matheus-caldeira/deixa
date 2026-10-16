CREATE TABLE "episode_recaps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"episode_id" uuid NOT NULL,
	"language_pair" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_recaps" ADD CONSTRAINT "episode_recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episode_recaps_unique" ON "episode_recaps" USING btree ("user_id","source","episode_id","language_pair");--> statement-breakpoint
CREATE INDEX "episode_recaps_user_due" ON "episode_recaps" USING btree ("user_id","due_at");