"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { KeyStatus } from "@/modules/ai-credentials";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const preferencesSchema = z
  .object({
    dailyGoal: z.number().int().optional(),
    preferredAccent: z.enum(["US", "UK"]).optional(),
    audioSpeed: z.number().optional(),
  })
  .strict();

export async function updatePreferencesAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("updatePreferences", async () => {
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().updatePreferences(user.id, parsed.data);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function saveApiKeyAction(apiKey: unknown): Promise<ActionResult<KeyStatus>> {
  const user = await requireUser();
  return runAction("saveApiKey", async () => {
    const parsed = z.string().max(200).safeParse(apiKey);
    if (!parsed.success) throw new AppError("AI_KEY_INVALID", "Essa chave não parece válida.");
    const status = await app().saveApiKey(user.id, parsed.data);
    revalidatePath("/", "layout");
    return status;
  });
}

export async function removeApiKeyAction(): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("removeApiKey", async () => {
    await app().removeApiKey(user.id);
    revalidatePath("/", "layout");
    return null;
  });
}
