import { eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { userAiModels } from "@/infrastructure/database/schema";
import type { ModelAssignment, ModelChoiceRepository } from "../application/model-choice-use-cases";
import {
  NO_MODEL_CHOICE,
  aiModelsSchema,
  modelChoiceSchema,
  type AiModels,
  type ModelChoice,
} from "../domain/model-choice";

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

  async getAssigned(userId: string): Promise<ModelChoice | null> {
    const [row] = await this.db
      .select({ assigned: userAiModels.assignedGeneration })
      .from(userAiModels)
      .where(eq(userAiModels.userId, userId))
      .limit(1);
    const parsed = modelChoiceSchema.safeParse(row?.assigned);
    return parsed.success ? parsed.data : null;
  }

  async listAssigned(): Promise<ModelAssignment[]> {
    const rows = await this.db
      .select({ userId: userAiModels.userId, assigned: userAiModels.assignedGeneration })
      .from(userAiModels)
      .where(isNotNull(userAiModels.assignedGeneration));
    return rows.flatMap((row) => {
      const parsed = modelChoiceSchema.safeParse(row.assigned);
      return parsed.success ? [{ userId: row.userId, generation: parsed.data }] : [];
    });
  }

  async saveAssigned(userId: string, generation: ModelChoice | null, assignedBy: string, now: Date) {
    await this.db
      .insert(userAiModels)
      .values({ userId, models: NO_MODEL_CHOICE, assignedGeneration: generation, assignedBy, updatedAt: now })
      .onConflictDoUpdate({
        target: userAiModels.userId,
        set: { assignedGeneration: generation, assignedBy, updatedAt: now },
      });
  }
}
