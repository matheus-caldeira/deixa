import { z } from "zod";
import type { ComponentProps } from "react";
import { pairOf } from "@/modules/identity";
import { AppError, isAppError } from "@/shared/errors";
import { routes } from "@/shared/routes";
import { operation, ViewRedirect } from "../operation";
import type { LessonScreen } from "@/ui/study/lesson-screen";

export const dynamic = "force-dynamic";

export const personalLessonView = {
  "view.personalLesson": operation({
    input: z.object({ id: z.string().optional(), node: z.string().optional() }),
    run: async (
      operationContext,
      input,
    ): Promise<ComponentProps<typeof LessonScreen> & { viewKey: string }> => {
      const { user, app } = operationContext;

      const { id: episodeId = "", node = "" } = input;
      const nodeIndex = Number(node);
      if (!z.uuid().safeParse(episodeId).success || !Number.isInteger(nodeIndex) || nodeIndex < 0)
        throw new AppError("MEDIA_NOT_FOUND");
      const lesson = await app
        .startPersonalLesson({
          userId: user.id,
          pair: pairOf(user.preferences),
          level: user.preferences.level,
          episodeId,
          nodeIndex,
        })
        .catch((error: unknown) => {
          if (isAppError(error)) throw new ViewRedirect(routes.personalEpisode(episodeId));
          throw error;
        });

      return {
        viewKey: `${episodeId}:${nodeIndex}`,
        view: {
          episodeId,
          nodeIndex,
          seed: lesson.seed,
          title: lesson.title,
          level: user.preferences.level,
          replay: lesson.replay,
          audioSpeed: user.preferences.audioSpeed,
          exercises: lesson.exercises,
          source: "personal",
          backHref: routes.personalTrail(),
        },
      };
    },
  }),
};
