import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import {
  NO_MODEL_CHOICE,
  aiModelsSchema,
  modelChoiceSchema,
  type AiModels,
  type ModelChoice,
} from "../domain/model-choice";
import { PROVIDERS_WITH_EMBEDDINGS } from "../domain/services";

export type ModelAssignment = { userId: string; generation: ModelChoice };

export interface ModelChoiceRepository {
  get(userId: string): Promise<AiModels | null>;
  save(userId: string, models: AiModels, now: Date): Promise<void>;
  getAssigned(userId: string): Promise<ModelChoice | null>;
  listAssigned(): Promise<ModelAssignment[]>;
  saveAssigned(userId: string, generation: ModelChoice | null, assignedBy: string, now: Date): Promise<void>;
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
    if (!parsed.success) throw new AppError("INVALID_INPUT", "modelInvalid");
    const embedding = parsed.data.embedding;
    if (embedding && embedding !== "local" && !PROVIDERS_WITH_EMBEDDINGS.has(embedding.provider)) {
      throw new AppError("INVALID_INPUT", "noEmbeddings");
    }
    await deps.choices.save(input.userId, parsed.data, deps.clock.now());
    return parsed.data;
  };
}

type Actor = { userId: string; isAdmin: boolean };

export function makeGetAssignedModel(deps: Pick<Deps, "choices">) {
  return async function getAssignedModel(userId: string): Promise<ModelChoice | null> {
    return deps.choices.getAssigned(userId);
  };
}

export function makeListModelAssignments(deps: Pick<Deps, "choices">) {
  return async function listModelAssignments(actor: Actor): Promise<ModelAssignment[]> {
    if (!actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyUsage");
    return deps.choices.listAssigned();
  };
}

export function makeAssignAiModel(deps: Deps) {
  return async function assignAiModel(input: {
    actor: Actor;
    userId: string;
    generation: unknown;
  }): Promise<ModelChoice | null> {
    if (!input.actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyUsage");
    const parsed = modelChoiceSchema.nullable().safeParse(input.generation);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "modelInvalid");
    await deps.choices.saveAssigned(input.userId, parsed.data, input.actor.userId, deps.clock.now());
    return parsed.data;
  };
}

export async function pickAiModel<T>(input: {
  chosen: ModelChoice | null;
  assigned: ModelChoice | null;
  serverDefault: ModelChoice | null;
  credentialFor: (choice: ModelChoice) => Promise<T | null>;
  isShared: (credential: T) => boolean;
}): Promise<{ choice: ModelChoice; credential: T } | null> {
  for (const choice of [input.chosen, input.assigned ?? input.serverDefault]) {
    if (!choice) continue;
    const credential = await input.credentialFor(choice);
    if (!credential) continue;
    if (input.assigned && choice !== input.assigned && input.isShared(credential)) continue;
    return { choice, credential };
  }
  return null;
}
