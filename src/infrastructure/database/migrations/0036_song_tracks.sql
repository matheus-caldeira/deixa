CREATE TABLE "song_tracks" (
	"episode_id" uuid PRIMARY KEY NOT NULL,
	"media_item_id" uuid NOT NULL,
	"youtube_video_id" text NOT NULL,
	"artist" text NOT NULL,
	"track_title" text NOT NULL,
	"duration_ms" integer,
	"lead_in_ms" integer DEFAULT 0 NOT NULL,
	"pauses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lyrics_source" text NOT NULL,
	"lyrics_external_id" text,
	"translation_source" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "song_tracks" ADD CONSTRAINT "song_tracks_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_tracks" ADD CONSTRAINT "song_tracks_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "song_tracks_media_video" ON "song_tracks" USING btree ("media_item_id","youtube_video_id");