"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { episodeLabel } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
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
      pair: pairOf(user.preferences),
      level: user.preferences.level,
      timezone: user.preferences.timezone,
      ...parsed.data,
    });
    await app().settleMissions(user.id, user.preferences.timezone);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function retryTrailAction(episodeId: unknown): Promise<ActionResult<{ status: string }>> {
  const user = await requireUser();
  return runAction("retryTrail", async () => {
    const parsed = z.uuid().safeParse(episodeId);
    if (!parsed.success) throw new AppError("EPISODE_NOT_FOUND");
    const context = await app().getEpisodeContext(parsed.data);
    if (!context) throw new AppError("EPISODE_NOT_FOUND");
    const status = await app().ensurePlan({
      userId: user.id,
      episodeId: parsed.data,
      pair: pairOf(user.preferences),
      level: user.preferences.level,
      episodeLabel: `${context.media.title} · ${episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)}`,
      retry: true,
    });
    if (status.status === "PENDING" && status.job) {
      const job = status.job;
      after(() => app().generatePlan(job));
    }
    revalidatePath("/");
    return { status: status.status };
  });
}
