import { inArray } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { aiLevelRatings } from "@/infrastructure/database/schema";
import { isCefrLevel } from "@/shared/levels";
import type { AiLevelRating, AiLevelRatingRepository } from "../application/level-sources";

export class DrizzleAiLevelRatingRepository implements AiLevelRatingRepository {
  constructor(private readonly db: Database) {}

  async save(rating: AiLevelRating): Promise<void> {
    const values = {
      levelMin: rating.range[0],
      levelMax: rating.range[1],
      reason: rating.reason,
      model: rating.model,
      ratedBy: rating.ratedBy,
      ratedAt: rating.ratedAt,
    };
    await this.db
      .insert(aiLevelRatings)
      .values({ externalId: rating.externalId, ...values })
      .onConflictDoUpdate({ target: aiLevelRatings.externalId, set: values });
  }

  async ratingsFor(externalIds: readonly string[]): Promise<Map<string, AiLevelRating>> {
    const found = new Map<string, AiLevelRating>();
    if (externalIds.length === 0) return found;
    const rows = await this.db
      .select()
      .from(aiLevelRatings)
      .where(inArray(aiLevelRatings.externalId, [...externalIds]));
    for (const row of rows) {
      if (!isCefrLevel(row.levelMin) || !isCefrLevel(row.levelMax)) continue;
      found.set(row.externalId, {
        externalId: row.externalId,
        range: [row.levelMin, row.levelMax],
        reason: row.reason,
        model: row.model,
        ratedBy: row.ratedBy,
        ratedAt: row.ratedAt,
      });
    }
    return found;
  }

  async listIds(): Promise<string[]> {
    const rows = await this.db.select({ externalId: aiLevelRatings.externalId }).from(aiLevelRatings);
    return rows.map((row) => row.externalId);
  }
}
