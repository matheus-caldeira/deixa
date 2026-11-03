import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const workEmbeddings = pgTable(
  "work_embeddings",
  {
    workKey: text("work_key").notNull(),
    model: text("model").notNull(),
    vector: jsonb("vector").notNull(),
    documentHash: text("document_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.workKey, table.model] })],
);

export const recommendationRuns = pgTable("recommendation_runs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  fingerprint: text("fingerprint"),
  writer: text("writer"),
  embedding: text("embedding"),
  insight: text("insight"),
  failureReason: text("failure_reason"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const userRecommendations = pgTable(
  "user_recommendations",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workKey: text("work_key").notNull(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title").notNull(),
    overview: text("overview").notNull(),
    year: integer("year"),
    posterPath: text("poster_path"),
    genres: jsonb("genres").notNull(),
    levelMin: text("level_min").notNull(),
    levelMax: text("level_max").notNull(),
    score: doublePrecision("score").notNull(),
    reason: text("reason").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workKey] })],
);

export const recommendationFeedback = pgTable(
  "recommendation_feedback",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workKey: text("work_key").notNull(),
    verdict: text("verdict").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workKey] })],
);

export const recommendationHistory = pgTable(
  "recommendation_history",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workKey: text("work_key").notNull(),
    firstSuggestedAt: timestamp("first_suggested_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workKey] })],
);
