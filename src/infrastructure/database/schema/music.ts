import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { episodes, mediaItems } from "./catalog";

export const songTracks = pgTable(
  "song_tracks",
  {
    episodeId: uuid("episode_id")
      .primaryKey()
      .references(() => episodes.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    youtubeVideoId: text("youtube_video_id").notNull(),
    artist: text("artist").notNull(),
    trackTitle: text("track_title").notNull(),
    durationMs: integer("duration_ms"),
    leadInMs: integer("lead_in_ms").notNull().default(0),
    pauses: jsonb("pauses").notNull().default([]),
    lyricsSource: text("lyrics_source").notNull(),
    lyricsExternalId: text("lyrics_external_id"),
    translationSource: text("translation_source").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("song_tracks_media_video").on(table.mediaItemId, table.youtubeVideoId)],
);
