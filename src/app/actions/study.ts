"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LessonResult } from "@/modules/study";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const MAX_ANSWERS = 12;
const answerSchema = z.union([
  z.null(),
  z.number().int().min(0).max(50),
  z.array(z.number().int().min(0).max(50)).max(30),
  z.string().max(400),
]);

export async function completeLessonAction(input: unknown): Promise<ActionResult<LessonResult>> {
  const user = await requireUser();
  return runAction("completeLesson", async () => {
    const parsed = z
      .object({
        episodeId: z.uuid(),
        nodeIndex: z.number().int().min(0).max(20),
        answers: z.array(answerSchema).max(MAX_ANSWERS),
        seconds: z.number().min(0).max(86_400),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const result = await app().completeLesson({
      userId: user.id,
      level: user.preferences.level,
      timezone: user.preferences.timezone,
      ...parsed.data,
    });
    await app().settleMissions(user.id, user.preferences.timezone);
    revalidatePath("/", "layout");
    return result;
  });
}
