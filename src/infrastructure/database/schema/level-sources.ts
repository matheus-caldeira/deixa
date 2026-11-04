import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { episodes, mediaItems } from "./catalog";
import { users } from "./identity";

export const levelSources = pgTable(
  "level_sources",
  {
    id: uuid("id").primaryKey(),
    url: text("url").notNull(),
    name: text("name"),
    parentId: uuid("parent_id").references((): AnyPgColumn => levelSources.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    status: text("status").notNull().default("PENDING"),
    ratingCount: integer("rating_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    lastError: text("last_error"),
    lastStatus: integer("last_status"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("level_sources_url").on(table.url)],
);

export const levelRatings = pgTable(
  "level_ratings",
  {
    sourceId: uuid("source_id")
      .notNull()
      .references(() => levelSources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    levelMin: text("level_min").notNull(),
    levelMax: text("level_max").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.externalId] }),
    index("level_ratings_external").on(table.externalId),
  ],
);

export const aiLevelRatings = pgTable("ai_level_ratings", {
  externalId: text("external_id").primaryKey(),
  levelMin: text("level_min").notNull(),
  levelMax: text("level_max").notNull(),
  reason: text("reason").notNull(),
  model: text("model").notNull(),
  ratedBy: uuid("rated_by").references(() => users.id, { onDelete: "set null" }),
  ratedAt: timestamp("rated_at", { withTimezone: true }).notNull(),
});

export const episodeLevelMeasurements = pgTable(
  "episode_level_measurements",
  {
    episodeId: uuid("episode_id")
      .primaryKey()
      .references(() => episodes.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    level: text("level").notNull(),
    score: doublePrecision("score").notNull(),
    words: integer("words").notNull(),
    wordsPerMinute: doublePrecision("words_per_minute").notNull(),
    meanSentenceWords: doublePrecision("mean_sentence_words").notNull(),
    lexicalDiversity: doublePrecision("lexical_diversity").notNull(),
    longWordRatio: doublePrecision("long_word_ratio").notNull(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("episode_level_measurements_media").on(table.mediaItemId)],
);
