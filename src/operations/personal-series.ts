import { z } from "zod";
import { pairOf } from "@/modules/identity";
import { LEVEL_MODES, MAX_SERIES_NAME } from "@/modules/personal-series";
import { CEFR_LEVELS } from "@/shared/levels";
import { answerSchema, MAX_ANSWERS } from "./lesson-answers";
import { operation } from "./operation";

const level = z.enum(CEFR_LEVELS).nullable();

export const personalSeriesOperations = {
  "personalSeries.rename": operation({
    input: z.string().max(MAX_SERIES_NAME * 2),
    refresh: true,
    run: async ({ user, app }, name) => {
      await app.renamePersonalSeries({
        userId: user.id,
        pair: pairOf(user.preferences),
        userLevel: user.preferences.level,
        name,
      });
      return null;
    },
  }),
  "personalSeries.setLevel": operation({
    input: z.object({ mode: z.enum(LEVEL_MODES), min: level, max: level }),
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.setPersonalSeriesLevel({
        userId: user.id,
        pair: pairOf(user.preferences),
        userLevel: user.preferences.level,
        level: input,
      });
      return null;
    },
  }),
  "personalSeries.completeLesson": operation({
    input: z.object({
      episodeId: z.uuid(),
      nodeIndex: z.number().int().min(0).max(50),
      seed: z.string().min(1).max(64),
      answers: z.array(answerSchema).max(MAX_ANSWERS),
    }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const result = await app.completePersonalLesson({
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
