import {
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
import { conversationSessions, learningItems } from "./learning";

export const personalSeries = pgTable(
  "personal_series",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetLanguage: text("target_language").notNull(),
    nativeLanguage: text("native_language").notNull(),
    name: text("name"),
    description: text("description"),
    descriptionUpdatedAt: timestamp("description_updated_at", { withTimezone: true }),
    descriptionBasis: jsonb("description_basis"),
    levelMode: text("level_mode").notNull().default("auto"),
    levelMin: text("level_min"),
    levelMax: text("level_max"),
    startLevel: text("start_level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("personal_series_user_pair").on(table.userId, table.targetLanguage, table.nativeLanguage),
  ],
);

export const personalSeasons = pgTable(
  "personal_seasons",
  {
    id: uuid("id").primaryKey(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => personalSeries.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    level: text("level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("personal_seasons_series_level").on(table.seriesId, table.level),
    uniqueIndex("personal_seasons_series_number").on(table.seriesId, table.number),
  ],
);

export const personalEpisodes = pgTable(
  "personal_episodes",
  {
    id: uuid("id").primaryKey(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => personalSeries.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => personalSeasons.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    theme: text("theme").notNull(),
    part: integer("part").notNull(),
    completedNodes: jsonb("completed_nodes").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("personal_episodes_season_theme_part").on(table.seasonId, table.theme, table.part),
    uniqueIndex("personal_episodes_season_number").on(table.seasonId, table.number),
  ],
);

export const personalEpisodeCards = pgTable(
  "personal_episode_cards",
  {
    seriesId: uuid("series_id")
      .notNull()
      .references(() => personalSeries.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => personalEpisodes.id, { onDelete: "cascade" }),
    learningItemId: uuid("learning_item_id")
      .notNull()
      .references(() => learningItems.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => conversationSessions.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.episodeId, table.learningItemId] }),
    uniqueIndex("personal_episode_cards_series_item").on(table.seriesId, table.learningItemId),
    index("personal_episode_cards_episode_position").on(table.episodeId, table.position),
  ],
);
