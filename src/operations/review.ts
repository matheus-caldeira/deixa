import { z } from "zod";
import { RATINGS } from "@/modules/flashcards";
import { pairOf } from "@/modules/identity";
import { operation } from "./operation";

export const reviewOperations = {
  "review.gradeCard": operation({
    input: z.object({
      cardId: z.uuid(),
      rating: z.enum(RATINGS),
      responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
    }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const result = await app.gradeCard({ userId: user.id, pair: pairOf(user.preferences), ...input });
      await app.settleMissions(user.id, user.preferences.timezone);
      return result;
    },
  }),
  "review.anticipate": operation({
    input: z.undefined(),
    refresh: true,
    run: async ({ user, app }) => app.anticipateReview(user.id, pairOf(user.preferences)),
  }),
};
