"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pairOf } from "@/modules/identity";
import { LEVEL_MODES, MAX_SERIES_NAME } from "@/modules/personal-series";
import type { LessonResult } from "@/modules/study";
import { CEFR_LEVELS } from "@/shared/levels";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { answerSchema, MAX_ANSWERS } from "./lesson-answers";
import { app, runAction, type ActionResult } from "./result";

export async function renamePersonalSeriesAction(name: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("renamePersonalSeries", async () => {
    const parsed = z
      .string()
      .max(MAX_SERIES_NAME * 2)
      .safeParse(name);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().renamePersonalSeries({
      userId: user.id,
      pair: pairOf(user.preferences),
      userLevel: user.preferences.level,
      name: parsed.data,
    });
    revalidatePath("/series");
    return null;
  });
}

export async function setPersonalSeriesLevelAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("setPersonalSeriesLevel", async () => {
    const level = z.enum(CEFR_LEVELS).nullable();
    const parsed = z.object({ mode: z.enum(LEVEL_MODES), min: level, max: level }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().setPersonalSeriesLevel({
      userId: user.id,
      pair: pairOf(user.preferences),
      userLevel: user.preferences.level,
      level: parsed.data,
    });
    revalidatePath("/series");
    return null;
  });
}

export async function completePersonalLessonAction(input: unknown): Promise<ActionResult<LessonResult>> {
  const user = await requireUser();
  return runAction("completePersonalLesson", async () => {
    const parsed = z
      .object({
        episodeId: z.uuid(),
        nodeIndex: z.number().int().min(0).max(50),
        seed: z.string().min(1).max(64),
        answers: z.array(answerSchema).max(MAX_ANSWERS),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const result = await app().completePersonalLesson({
      userId: user.id,
      pair: pairOf(user.preferences),
      level: user.preferences.level,
      ...parsed.data,
    });
    await app().settleMissions(user.id, user.preferences.timezone);
    revalidatePath("/", "layout");
    return result;
  });
}
