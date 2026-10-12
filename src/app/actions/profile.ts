"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CREDENTIAL_SERVICES, type StoredState } from "@/modules/ai-credentials";
import { refreshSettings } from "@/infrastructure/container";
import type { AppSettings } from "@/modules/settings";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const MAX_SECRET_CHARS = 1000;

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

const credentialTarget = z.object({
  service: z.enum(CREDENTIAL_SERVICES),
  scope: z.enum(["user", "global"]),
});

export async function saveCredentialAction(input: unknown): Promise<ActionResult<StoredState>> {
  const user = await requireUser();
  return runAction("saveCredential", async () => {
    const parsed = credentialTarget
      .extend({ secret: z.string().min(1).max(MAX_SECRET_CHARS) })
      .safeParse(input);
    if (!parsed.success) throw new AppError("AI_KEY_INVALID", "Essa chave não parece válida.");
    const state = await app().saveCredential({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      ...parsed.data,
    });
    revalidatePath("/", "layout");
    return state;
  });
}

export async function removeCredentialAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("removeCredential", async () => {
    const parsed = credentialTarget.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().removeCredential({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...parsed.data });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult<AppSettings>> {
  const user = await requireUser();
  return runAction("updateSettings", async () => {
    const saved = await app().updateSettings({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      values: input,
    });
    await refreshSettings();
    revalidatePath("/", "layout");
    return saved;
  });
}
