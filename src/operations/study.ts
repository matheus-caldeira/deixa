import { z } from "zod";
import { episodeLabel } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { AppError } from "@/shared/errors";
import { answerSchema, MAX_ANSWERS } from "./lesson-answers";
import { operation } from "./operation";

export const studyOperations = {
  "study.completeLesson": operation({
    input: z.object({
      episodeId: z.uuid(),
      nodeIndex: z.number().int().min(0).max(20),
      seed: z.string().min(1).max(64),
      answers: z.array(answerSchema).max(MAX_ANSWERS),
      seconds: z.number().min(0).max(86_400),
    }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const result = await app.completeLesson({
        userId: user.id,
        pair: pairOf(user.preferences),
        level: user.preferences.level,
        timezone: user.preferences.timezone,
        ...input,
      });
      await app.settleMissions(user.id, user.preferences.timezone);
      return result;
    },
  }),
  "study.retryTrail": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app, schedule }, episodeId) => {
      const parsed = z.uuid().safeParse(episodeId);
      if (!parsed.success) throw new AppError("EPISODE_NOT_FOUND");
      const context = await app.getEpisodeContext(parsed.data);
      if (!context) throw new AppError("EPISODE_NOT_FOUND");
      const status = await app.ensurePlan({
        userId: user.id,
        episodeId: parsed.data,
        pair: pairOf(user.preferences),
        level: user.preferences.level,
        episodeLabel: `${context.media.title} · ${episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)}`,
        retry: true,
      });
      if (status.status === "PENDING" && status.job) await schedule("generate_plan", status.job);
      return { status: status.status };
    },
  }),
  "study.completeRecap": operation({
    input: z.object({
      recapId: z.uuid(),
      seed: z.string().min(1).max(64),
      answers: z.array(answerSchema).max(MAX_ANSWERS),
    }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const result = await app.completeRecap({
        userId: user.id,
        pair: pairOf(user.preferences),
        level: user.preferences.level,
        ...input,
      });
      await app.settleMissions(user.id, user.preferences.timezone);
      return result;
    },
  }),
};
