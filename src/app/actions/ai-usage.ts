"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshSettings } from "@/infrastructure/container";
import { usageLimitSchema, type ModelPrice, type UsageLimit } from "@/modules/ai-usage";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const keySchema = z.enum(["own", "shared"]);
const targetSchema = z.union([
  z.object({ scope: z.literal("own"), key: keySchema }),
  z.object({ scope: z.literal("person"), userId: z.uuid(), key: keySchema }),
]);

export async function setAiUsageLimitAction(input: unknown): Promise<ActionResult<UsageLimit>> {
  const user = await requireUser();
  return runAction("setAiUsageLimit", async () => {
    const parsed = z.object({ target: targetSchema, limit: z.unknown() }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const saved = await app().setAiUsageLimit({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      target: parsed.data.target,
      limit: parsed.data.limit,
    });
    revalidatePath("/settings");
    return saved;
  });
}

export async function updateSharedAiLimitAction(input: unknown): Promise<ActionResult<UsageLimit>> {
  const user = await requireUser();
  return runAction("updateSharedAiLimit", async () => {
    const parsed = usageLimitSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "limitInvalid");
    const current = await app().getSettings();
    const saved = await app().updateSettings({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      values: { ...current, aiSharedLimit: parsed.data },
    });
    await refreshSettings();
    revalidatePath("/settings");
    return saved.aiSharedLimit;
  });
}

export async function saveModelPriceAction(input: unknown): Promise<ActionResult<ModelPrice>> {
  const user = await requireUser();
  return runAction("saveModelPrice", async () => {
    const saved = await app().saveModelPrice({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      price: input,
    });
    revalidatePath("/settings");
    return saved;
  });
}
