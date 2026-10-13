import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { NO_MODEL_CHOICE, aiModelsSchema, type AiModels } from "../domain/model-choice";
import { PROVIDERS_WITH_EMBEDDINGS } from "../domain/services";

export interface ModelChoiceRepository {
  get(userId: string): Promise<AiModels | null>;
  save(userId: string, models: AiModels, now: Date): Promise<void>;
}

type Deps = { choices: ModelChoiceRepository; clock: Clock };

export function makeGetAiModels(deps: Pick<Deps, "choices">) {
  return async function getAiModels(userId: string): Promise<AiModels> {
    return (await deps.choices.get(userId)) ?? NO_MODEL_CHOICE;
  };
}

export function makeSetAiModels(deps: Deps) {
  return async function setAiModels(input: { userId: string; models: unknown }): Promise<AiModels> {
    const parsed = aiModelsSchema.safeParse(input.models);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "Confira o provedor e o nome do modelo.");
    const embedding = parsed.data.embedding;
    if (embedding && embedding !== "local" && !PROVIDERS_WITH_EMBEDDINGS.has(embedding.provider)) {
      throw new AppError("INVALID_INPUT", "Esse provedor não oferece embeddings.");
    }
    await deps.choices.save(input.userId, parsed.data, deps.clock.now());
    return parsed.data;
  };
}
