import { z } from "zod";
import type { ComponentProps } from "react";
import { pairOf } from "@/modules/identity";
import { AppError, isAppError } from "@/shared/errors";
import { routes } from "@/shared/routes";
import { operation, ViewRedirect } from "../operation";
import type { LessonScreen } from "@/ui/study/lesson-screen";

export const dynamic = "force-dynamic";

export const studyView = {
  "view.study": operation({
    input: z.object({ id: z.string().optional(), node: z.string().optional() }),
    run: async (
      operationContext,
      input,
    ): Promise<ComponentProps<typeof LessonScreen> & { viewKey: string }> => {
      const { user, app, translator } = operationContext;

      const { id: episodeId = "", node = "" } = input;
      const nodeIndex = Number(node);
      if (!z.uuid().safeParse(episodeId).success || !Number.isInteger(nodeIndex) || nodeIndex < 0)
        throw new AppError("MEDIA_NOT_FOUND");
      const lesson = await app
        .startLesson({
          userId: user.id,
          episodeId,
          nodeIndex,
          pair: pairOf(user.preferences),
          level: user.preferences.level,
        })
        .catch((error: unknown) => {
          if (isAppError(error)) throw new ViewRedirect("/");
          throw error;
        });
      const t = await translator("home");
      const context = await app.getEpisodeContext(episodeId);
      const backHref = !context
        ? "/"
        : context.media.type === "movie"
          ? routes.trail(context.media.id)
          : routes.trail(context.media.id, context.season.seasonNumber);

      return {
        viewKey: `${episodeId}:${nodeIndex}`,
        view: {
          episodeId,
          nodeIndex: lesson.nodeIndex,
          seed: lesson.seed,
          title:
            lesson.title ||
            t(lesson.isFinal ? "finalChallenge" : "sceneTitle", { number: lesson.nodeIndex + 1 }),
          level: user.preferences.level,
          replay: lesson.replay,
          audioSpeed: user.preferences.audioSpeed,
          exercises: lesson.exercises,
          backHref,
        },
      };
    },
  }),
};
