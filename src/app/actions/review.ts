"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RATINGS } from "@/modules/flashcards";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

export async function gradeCardAction(
  input: unknown,
): Promise<ActionResult<{ dueCount: number; xpAwarded: number }>> {
  const user = await requireUser();
  return runAction("gradeCard", async () => {
    const parsed = z
      .object({
        cardId: z.uuid(),
        rating: z.enum(RATINGS),
        responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const result = await app().gradeCard({ userId: user.id, ...parsed.data });
    await app().settleMissions(user.id, user.preferences.timezone);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function anticipateReviewAction(): Promise<ActionResult<{ moved: number }>> {
  const user = await requireUser();
  return runAction("anticipateReview", async () => {
    const result = await app().anticipateReview(user.id, user.preferences.timezone);
    revalidatePath("/", "layout");
    return result;
  });
}
