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
import { episodes, subtitleCues, subtitleFiles } from "./catalog";

export const learningItems = pgTable(
  "learning_items",
  {
    id: uuid("id").primaryKey(),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    subtitleFileId: uuid("subtitle_file_id").references(() => subtitleFiles.id, { onDelete: "set null" }),
    cueId: uuid("cue_id").references(() => subtitleCues.id, { onDelete: "set null" }),
    startToken: integer("start_token"),
    endToken: integer("end_token"),
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    sourceText: text("source_text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    contextText: text("context_text"),
    difficulty: text("difficulty").notNull(),
    itemType: text("item_type").notNull(),
    origin: text("origin").notNull(),
    visibility: text("visibility").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("learning_items_episode").on(table.episodeId)],
);

export const learningItemExplanations = pgTable(
  "learning_item_explanations",
  {
    learningItemId: uuid("learning_item_id")
      .notNull()
      .references(() => learningItems.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    translation: text("translation").notNull(),
    translationSource: text("translation_source").notNull(),
    contextTranslation: text("context_translation"),
    contextTranslationSource: text("context_translation_source"),
    pronunciationGuide: text("pronunciation_guide"),
    ipa: text("ipa"),
    grammarNote: text("grammar_note"),
    contextNote: text("context_note"),
    exampleEnglish: text("example_english"),
    examplePortuguese: text("example_portuguese"),
  },
  (table) => [primaryKey({ columns: [table.learningItemId, table.locale] })],
);

export const highlightCardBatches = pgTable(
  "highlight_card_batches",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    shareScope: text("share_scope"),
    highlightsCount: integer("highlights_count").notNull(),
    cardsCreated: integer("cards_created").notNull(),
    llmCalls: integer("llm_calls").notNull(),
    llmProvider: text("llm_provider").notNull(),
    draft: jsonb("draft").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("highlight_card_batches_user").on(table.userId)],
);

export const userHighlights = pgTable(
  "user_highlights",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    cueId: uuid("cue_id")
      .notNull()
      .references(() => subtitleCues.id, { onDelete: "cascade" }),
    startToken: integer("start_token").notNull(),
    endToken: integer("end_token").notNull(),
    kind: text("kind").notNull(),
    shareScope: text("share_scope").notNull(),
    cardBatchId: uuid("card_batch_id").references(() => highlightCardBatches.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("user_highlights_unique").on(
      table.userId,
      table.cueId,
      table.startToken,
      table.endToken,
      table.kind,
    ),
    index("user_highlights_user_episode").on(table.userId, table.episodeId),
  ],
);

export const highlightStats = pgTable(
  "highlight_stats",
  {
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    cueId: uuid("cue_id")
      .notNull()
      .references(() => subtitleCues.id, { onDelete: "cascade" }),
    startToken: integer("start_token").notNull(),
    endToken: integer("end_token").notNull(),
    userCount: integer("user_count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.cueId, table.startToken, table.endToken] })],
);

export const userCards = pgTable(
  "user_cards",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    learningItemId: uuid("learning_item_id")
      .notNull()
      .references(() => learningItems.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    intervalDays: doublePrecision("interval_days").notNull(),
    repetitions: integer("repetitions").notNull(),
    lapses: integer("lapses").notNull(),
    stability: doublePrecision("stability").notNull(),
    difficulty: doublePrecision("difficulty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("user_cards_user_item").on(table.userId, table.learningItemId),
    index("user_cards_due").on(table.userId, table.dueAt),
  ],
);

export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").primaryKey(),
  userCardId: uuid("user_card_id")
    .notNull()
    .references(() => userCards.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(),
  responseTimeMs: integer("response_time_ms"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
});

export const episodeProgress = pgTable(
  "episode_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    progressPercent: integer("progress_percent").notNull(),
    lastPositionMs: integer("last_position_ms"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.episodeId] })],
);

export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("xp_events_dedupe").on(table.userId, table.source, table.sourceId),
    index("xp_events_user_created").on(table.userId, table.createdAt),
  ],
);

export const lessonAttempts = pgTable(
  "lesson_attempts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    nodeIndex: integer("node_index").notNull(),
    level: text("level").notNull(),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
    xp: integer("xp").notNull(),
    seconds: integer("seconds").notNull(),
    replay: boolean("replay").notNull(),
    passed: boolean("passed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("lesson_attempts_user_episode").on(table.userId, table.episodeId)],
);

export const lessonPlans = pgTable(
  "lesson_plans",
  {
    id: uuid("id").primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    level: text("level").notNull(),
    status: text("status").notNull(),
    provider: text("provider"),
    plan: jsonb("plan"),
    failureReason: text("failure_reason"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("lesson_plans_episode_level").on(table.episodeId, table.level)],
);

export const reviewAnticipations = pgTable(
  "review_anticipations",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    ordinal: integer("ordinal").notNull(),
    cardsMoved: integer("cards_moved").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("review_anticipations_user_created").on(table.userId, table.createdAt),
    uniqueIndex("review_anticipations_slot").on(table.userId, table.day, table.ordinal),
  ],
);

export const conversationSessions = pgTable(
  "conversation_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    themeId: text("theme_id").notNull(),
    themeTitle: text("theme_title").notNull(),
    level: text("level").notNull(),
    review: jsonb("review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("conversation_sessions_user").on(table.userId, table.createdAt)],
);

export const conversationTurns = pgTable(
  "conversation_turns",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => conversationSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    text: text("text").notNull(),
    translation: text("translation"),
    corrections: jsonb("corrections").notNull(),
    inputKind: text("input_kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("conversation_turns_session").on(table.sessionId, table.createdAt)],
);
