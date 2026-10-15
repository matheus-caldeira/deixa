"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const workKeySchema = z.string().min(3).max(80);

export async function acceptRecommendationAction(
  workKey: unknown,
): Promise<ActionResult<{ mediaId: string }>> {
  const user = await requireUser();
  return runAction("acceptRecommendation", async () => {
    const parsed = workKeySchema.safeParse(workKey);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const suggestion = await app().findRecommendation(user.id, parsed.data);
    if (!suggestion) throw new AppError("MEDIA_NOT_FOUND");
    const { mediaId } = await app().registerWork({
      userId: user.id,
      type: suggestion.type,
      externalId: suggestion.externalId,
    });
    await app().acceptRecommendation({ userId: user.id, workKey: parsed.data });
    revalidatePath("/catalog");
    return { mediaId };
  });
}

export async function dismissRecommendationAction(workKey: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("dismissRecommendation", async () => {
    const parsed = workKeySchema.safeParse(workKey);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().dismissRecommendation({ userId: user.id, workKey: parsed.data });
    revalidatePath("/catalog");
    return null;
  });
}

export async function refreshRecommendationsAction(): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("refreshRecommendations", async () => {
    const container = app();
    const input = {
      userId: user.id,
      level: user.preferences.level,
      language: user.preferences.targetLanguage,
    };
    after(() => container.refreshRecommendations(input).catch(() => undefined));
    return null;
  });
}
