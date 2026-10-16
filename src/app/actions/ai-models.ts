"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshSettings } from "@/infrastructure/container";
import { modelChoiceSchema, type AiModels, type ModelChoice } from "@/modules/ai-credentials";
import type { AppSettings } from "@/modules/settings";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

export async function setAiModelsAction(input: unknown): Promise<ActionResult<AiModels>> {
  const user = await requireUser();
  return runAction("setAiModels", async () => {
    const saved = await app().setAiModels({ userId: user.id, models: input });
    revalidatePath("/settings");
    return saved;
  });
}

export async function assignAiModelAction(input: unknown): Promise<ActionResult<ModelChoice | null>> {
  const user = await requireUser();
  return runAction("assignAiModel", async () => {
    const parsed = z.object({ userId: z.uuid(), generation: z.unknown() }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const saved = await app().assignAiModel({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      userId: parsed.data.userId,
      generation: parsed.data.generation,
    });
    revalidatePath("/settings");
    return saved;
  });
}

const defaultsSchema = z.object({
  aiGeneration: modelChoiceSchema,
  aiEmbedding: modelChoiceSchema.nullable(),
});

export async function updateAiDefaultsAction(input: unknown): Promise<ActionResult<AppSettings>> {
  const user = await requireUser();
  return runAction("updateAiDefaults", async () => {
    const parsed = defaultsSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "modelInvalid");
    const current = await app().getSettings();
    const saved = await app().updateSettings({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      values: { ...current, ...parsed.data },
    });
    await refreshSettings();
    revalidatePath("/settings");
    return saved;
  });
}
