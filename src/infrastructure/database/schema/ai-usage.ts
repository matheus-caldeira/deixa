import {
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    operation: text("operation").notNull(),
    keySource: text("key_source").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    estimatedCostUsd: doublePrecision("estimated_cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("ai_usage_events_user_created").on(table.userId, table.createdAt)],
);

export const aiModelPrices = pgTable(
  "ai_model_prices",
  {
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputUsdPerMillion: doublePrecision("input_usd_per_million").notNull(),
    outputUsdPerMillion: doublePrecision("output_usd_per_million").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.model] })],
);
