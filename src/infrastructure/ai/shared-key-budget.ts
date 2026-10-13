import { and, eq, lt, sql } from "drizzle-orm";
import type { LlmProvider } from "@/modules/learning";
import type { TutorProvider } from "@/modules/conversations";
import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { Database } from "../database/client";
import { aiUsage } from "../database/schema";

export const SHARED_KEY_CALLS_PER_DAY = 60;
const LIMIT_MESSAGE =
  "Você atingiu o limite diário de uso da IA compartilhada. Cadastre sua chave do Google AI no perfil ou volte amanhã.";

export class SharedKeyBudget {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly limit = SHARED_KEY_CALLS_PER_DAY,
  ) {}

  async spend(userId: string): Promise<void> {
    const day = this.clock.now().toISOString().slice(0, 10);
    const claimed = await this.db
      .insert(aiUsage)
      .values({ userId, day, calls: 1 })
      .onConflictDoUpdate({
        target: [aiUsage.userId, aiUsage.day],
        set: { calls: sql`${aiUsage.calls} + 1` },
        setWhere: and(eq(aiUsage.userId, userId), lt(aiUsage.calls, this.limit)),
      })
      .returning({ calls: aiUsage.calls });
    if (claimed.length === 0) throw new AppError("LLM_FAILED", LIMIT_MESSAGE);
  }
}

type Spend = () => Promise<void>;

export function budgetedLlm(provider: LlmProvider, spend: Spend): LlmProvider {
  return {
    name: provider.name,
    explainTerms: async (request) => {
      await spend();
      return provider.explainTerms(request);
    },
    translateLines: async (lines) => {
      await spend();
      return provider.translateLines(lines);
    },
  };
}

export function budgetedTutor(tutor: TutorProvider, spend: Spend): TutorProvider {
  return {
    name: tutor.name,
    reply: async (input) => {
      await spend();
      return tutor.reply(input);
    },
    review: async (input) => {
      await spend();
      return tutor.review(input);
    },
  };
}
