CREATE TABLE "personal_episode_cards" (
	"series_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"learning_item_id" uuid NOT NULL,
	"session_id" uuid,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "personal_episode_cards_episode_id_learning_item_id_pk" PRIMARY KEY("episode_id","learning_item_id")
);
--> statement-breakpoint
CREATE TABLE "personal_episodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"series_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"theme" text NOT NULL,
	"part" integer NOT NULL,
	"completed_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_seasons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"series_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"level" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_series" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"target_language" text NOT NULL,
	"native_language" text NOT NULL,
	"name" text,
	"description" text,
	"description_updated_at" timestamp with time zone,
	"description_basis" jsonb,
	"level_mode" text DEFAULT 'auto' NOT NULL,
	"level_min" text,
	"level_max" text,
	"start_level" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_episode_cards" ADD CONSTRAINT "personal_episode_cards_series_id_personal_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."personal_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_episode_cards" ADD CONSTRAINT "personal_episode_cards_episode_id_personal_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."personal_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_episode_cards" ADD CONSTRAINT "personal_episode_cards_learning_item_id_learning_items_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_episode_cards" ADD CONSTRAINT "personal_episode_cards_session_id_conversation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_episodes" ADD CONSTRAINT "personal_episodes_series_id_personal_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."personal_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_episodes" ADD CONSTRAINT "personal_episodes_season_id_personal_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."personal_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_seasons" ADD CONSTRAINT "personal_seasons_series_id_personal_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."personal_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_series" ADD CONSTRAINT "personal_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "personal_episode_cards_series_item" ON "personal_episode_cards" USING btree ("series_id","learning_item_id");--> statement-breakpoint
CREATE INDEX "personal_episode_cards_episode_position" ON "personal_episode_cards" USING btree ("episode_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_episodes_season_theme_part" ON "personal_episodes" USING btree ("season_id","theme","part");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_episodes_season_number" ON "personal_episodes" USING btree ("season_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_seasons_series_level" ON "personal_seasons" USING btree ("series_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_seasons_series_number" ON "personal_seasons" USING btree ("series_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_series_user_pair" ON "personal_series" USING btree ("user_id","target_language","native_language");