import { z } from "zod";
import { AppError } from "@/shared/errors";
import { operation } from "./operation";

const workKeySchema = z.string().min(3).max(80);

export const recommendationOperations = {
  "recommendations.accept": operation({
    input: workKeySchema,
    refresh: true,
    run: async ({ user, app }, workKey) => {
      const suggestion = await app.findRecommendation(user.id, workKey);
      if (!suggestion) throw new AppError("MEDIA_NOT_FOUND");
      const { mediaId } = await app.registerWork({
        userId: user.id,
        type: suggestion.type,
        externalId: suggestion.externalId,
      });
      await app.acceptRecommendation({ userId: user.id, workKey });
      return { mediaId };
    },
  }),
  "recommendations.dismiss": operation({
    input: workKeySchema,
    refresh: true,
    run: async ({ user, app }, workKey) => {
      await app.dismissRecommendation({ userId: user.id, workKey });
      return null;
    },
  }),
  "recommendations.refresh": operation({
    input: z.undefined(),
    run: async ({ user, schedule }) => {
      await schedule("refresh_recommendations", {
        userId: user.id,
        level: user.preferences.level,
        language: user.preferences.targetLanguage,
      });
      return null;
    },
  }),
};
