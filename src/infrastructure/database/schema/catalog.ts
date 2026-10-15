import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title").notNull(),
    overview: text("overview").notNull(),
    year: integer("year"),
    metadataProvider: text("metadata_provider").notNull(),
    externalId: text("external_id").notNull(),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    posterColors: jsonb("poster_colors"),
    levelMin: text("level_min").notNull(),
    levelMax: text("level_max").notNull(),
    accent: text("accent"),
    originalLanguage: text("original_language").notNull().default("en"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    metadataSyncedAt: timestamp("metadata_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("media_items_provider_external").on(table.metadataProvider, table.externalId)],
);

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey(),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull(),
    title: text("title").notNull(),
    episodeCount: integer("episode_count"),
    episodesSyncedAt: timestamp("episodes_synced_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("seasons_media_number").on(table.mediaItemId, table.seasonNumber)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number").notNull(),
    title: text("title").notNull(),
    overview: text("overview").notNull(),
    durationSeconds: integer("duration_seconds"),
    stillPath: text("still_path"),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    cueCount: integer("cue_count").notNull(),
    alignmentPairs: integer("alignment_pairs"),
    alignmentRate: doublePrecision("alignment_rate"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("episodes_season_number").on(table.seasonId, table.episodeNumber)],
);

export const subtitleFiles = pgTable(
  "subtitle_files",
  {
    id: uuid("id").primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    format: text("format").notNull(),
    storagePath: text("storage_path").notNull(),
    sha256: text("sha256").notNull(),
    status: text("status").notNull(),
    processingVersion: integer("processing_version").notNull(),
    originalFilename: text("original_filename").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    source: text("source").notNull().default("upload"),
    externalFileId: text("external_file_id"),
    releaseName: text("release_name"),
    sourceAuthor: text("source_author"),
    hearingImpaired: boolean("hearing_impaired"),
    fps: doublePrecision("fps"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("subtitle_files_external")
      .on(table.source, table.externalFileId)
      .where(sql`${table.externalFileId} is not null`),
    uniqueIndex("subtitle_files_dedupe").on(
      table.episodeId,
      table.language,
      table.processingVersion,
      table.sha256,
    ),
    uniqueIndex("subtitle_files_episode_language").on(table.episodeId, table.language),
  ],
);

export const subtitleCues = pgTable(
  "subtitle_cues",
  {
    id: uuid("id").primaryKey(),
    subtitleFileId: uuid("subtitle_file_id")
      .notNull()
      .references(() => subtitleFiles.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    text: text("text").notNull(),
  },
  (table) => [uniqueIndex("subtitle_cues_file_sequence").on(table.subtitleFileId, table.sequence)],
);

export const cueAlignments = pgTable(
  "cue_alignments",
  {
    id: uuid("id").primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    sourceCueId: uuid("source_cue_id")
      .notNull()
      .references(() => subtitleCues.id, { onDelete: "cascade" }),
    targetLanguage: text("target_language").notNull().default("pt-BR"),
    alignedCueIds: jsonb("aligned_cue_ids").$type<string[]>().notNull(),
    overlapScore: doublePrecision("overlap_score").notNull(),
    offsetMs: integer("offset_ms").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    uniqueIndex("cue_alignments_source_language").on(table.sourceCueId, table.targetLanguage),
    index("cue_alignments_episode").on(table.episodeId),
  ],
);

export const cueTranslations = pgTable(
  "cue_translations",
  {
    cueId: uuid("cue_id")
      .notNull()
      .references(() => subtitleCues.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    text: text("text").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.cueId, table.locale] })],
);

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull(),
    steps: jsonb("steps")
      .$type<{ key: string; detail: { key: string; params?: Record<string, string | number> } }[]>()
      .notNull(),
    failureReason: text("failure_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("processing_jobs_episode").on(table.episodeId)],
);

export const audioAssets = pgTable(
  "audio_assets",
  {
    id: uuid("id").primaryKey(),
    textHash: text("text_hash").notNull(),
    voiceId: text("voice_id").notNull(),
    language: text("language").notNull(),
    modelVersion: text("model_version").notNull(),
    format: text("format").notNull(),
    storagePath: text("storage_path").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("audio_assets_hash_voice").on(table.textHash, table.voiceId)],
);

export const subtitleSearchCache = pgTable("subtitle_search_cache", {
  episodeId: uuid("episode_id")
    .primaryKey()
    .references(() => episodes.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  languages: text("languages").notNull(),
  resultsJson: jsonb("results_json").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const subtitleDownloads = pgTable(
  "subtitle_downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalFileId: text("external_file_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("subtitle_downloads_user_time").on(table.userId, table.createdAt)],
);

export const externalApiQuota = pgTable("external_api_quota", {
  provider: text("provider").primaryKey(),
  remaining: integer("remaining").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const episodeScripts = pgTable(
  "episode_scripts",
  {
    id: uuid("id").primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    storagePath: text("storage_path").notNull(),
    sha256: text("sha256").notNull(),
    status: text("status").notNull(),
    lineCount: integer("line_count").notNull(),
    matchedCount: integer("matched_count").notNull(),
    cueCount: integer("cue_count").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("episode_scripts_episode_language").on(table.episodeId, table.language)],
);

export const scriptLines = pgTable(
  "script_lines",
  {
    id: uuid("id").primaryKey(),
    scriptId: uuid("script_id")
      .notNull()
      .references(() => episodeScripts.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    text: text("text").notNull(),
    matchedCueId: uuid("matched_cue_id").references(() => subtitleCues.id, { onDelete: "set null" }),
    verified: boolean("verified").notNull(),
  },
  (table) => [
    index("script_lines_script_sequence").on(table.scriptId, table.sequence),
    index("script_lines_cue").on(table.matchedCueId),
  ],
);
