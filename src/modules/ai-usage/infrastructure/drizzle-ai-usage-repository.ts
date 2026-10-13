import { and, desc, eq, gte } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { aiModelPrices, aiUsageEvents } from "@/infrastructure/database/schema";
import type { AiUsageRepository, ModelPriceRepository, StoredModelPrice } from "../application/ports";
import {
  AI_OPERATIONS,
  KEY_SOURCES,
  type AiOperation,
  type AiUsageEvent,
  type KeySource,
  type ModelPrice,
} from "../domain/usage";

const asOperation = (value: string): AiOperation =>
  AI_OPERATIONS.find((operation) => operation === value) ?? "cards";
const asKeySource = (value: string): KeySource => KEY_SOURCES.find((source) => source === value) ?? "user";

export class DrizzleAiUsageRepository implements AiUsageRepository {
  constructor(private readonly db: Database) {}

  async record(event: AiUsageEvent): Promise<void> {
    await this.db.insert(aiUsageEvents).values(event);
  }

  async listEvents(userId: string, since: Date): Promise<AiUsageEvent[]> {
    const rows = await this.db
      .select()
      .from(aiUsageEvents)
      .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)))
      .orderBy(desc(aiUsageEvents.createdAt));
    return rows.map((row) => ({
      ...row,
      operation: asOperation(row.operation),
      keySource: asKeySource(row.keySource),
    }));
  }
}

export class DrizzleModelPriceRepository implements ModelPriceRepository {
  constructor(private readonly db: Database) {}

  async find(provider: string, model: string): Promise<StoredModelPrice | null> {
    const [row] = await this.db
      .select()
      .from(aiModelPrices)
      .where(and(eq(aiModelPrices.provider, provider), eq(aiModelPrices.model, model)))
      .limit(1);
    return row ? toStored(row) : null;
  }

  async list(): Promise<StoredModelPrice[]> {
    const rows = await this.db
      .select()
      .from(aiModelPrices)
      .orderBy(aiModelPrices.provider, aiModelPrices.model);
    return rows.map(toStored);
  }

  async save(price: ModelPrice, updatedBy: string, now: Date): Promise<void> {
    await this.db
      .insert(aiModelPrices)
      .values({ ...price, updatedBy, updatedAt: now })
      .onConflictDoUpdate({
        target: [aiModelPrices.provider, aiModelPrices.model],
        set: {
          inputUsdPerMillion: price.inputUsdPerMillion,
          outputUsdPerMillion: price.outputUsdPerMillion,
          updatedBy,
          updatedAt: now,
        },
      });
  }
}

function toStored(row: typeof aiModelPrices.$inferSelect): StoredModelPrice {
  return {
    provider: row.provider,
    model: row.model,
    inputUsdPerMillion: row.inputUsdPerMillion,
    outputUsdPerMillion: row.outputUsdPerMillion,
    updatedAt: row.updatedAt,
  };
}
