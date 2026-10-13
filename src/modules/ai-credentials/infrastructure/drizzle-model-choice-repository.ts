import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { userAiModels } from "@/infrastructure/database/schema";
import type { ModelChoiceRepository } from "../application/model-choice-use-cases";
import { aiModelsSchema, type AiModels } from "../domain/model-choice";

export class DrizzleModelChoiceRepository implements ModelChoiceRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<AiModels | null> {
    const [row] = await this.db.select().from(userAiModels).where(eq(userAiModels.userId, userId)).limit(1);
    if (!row) return null;
    const parsed = aiModelsSchema.safeParse(row.models);
    return parsed.success ? parsed.data : null;
  }

  async save(userId: string, models: AiModels, now: Date): Promise<void> {
    await this.db
      .insert(userAiModels)
      .values({ userId, models, updatedAt: now })
      .onConflictDoUpdate({ target: userAiModels.userId, set: { models, updatedAt: now } });
  }
}
