CREATE TABLE "episode_level_measurements" (
	"episode_id" uuid PRIMARY KEY NOT NULL,
	"media_item_id" uuid NOT NULL,
	"language" text NOT NULL,
	"level" text NOT NULL,
	"score" double precision NOT NULL,
	"words" integer NOT NULL,
	"words_per_minute" double precision NOT NULL,
	"mean_sentence_words" double precision NOT NULL,
	"lexical_diversity" double precision NOT NULL,
	"long_word_ratio" double precision NOT NULL,
	"measured_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_level_measurements" ADD CONSTRAINT "episode_level_measurements_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_level_measurements" ADD CONSTRAINT "episode_level_measurements_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_level_measurements_media" ON "episode_level_measurements" USING btree ("media_item_id");