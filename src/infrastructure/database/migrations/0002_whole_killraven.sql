CREATE TABLE "lesson_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"node_index" integer NOT NULL,
	"level" text NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"xp" integer NOT NULL,
	"seconds" integer NOT NULL,
	"replay" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_attempts_user_episode" ON "lesson_attempts" USING btree ("user_id","episode_id");