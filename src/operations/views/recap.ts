import { z } from "zod";
import type { ComponentProps } from "react";
import { pairOf } from "@/modules/identity";
import { RECAP_STEPS } from "@/modules/study";
import { AppError, isAppError } from "@/shared/errors";
import { operation, ViewRedirect } from "../operation";
import type { RecapScreen } from "@/ui/review/recap-screen";

export const dynamic = "force-dynamic";

export const recapView = {
  "view.recap": operation({
    input: z.object({ id: z.string().optional() }),
    run: async (operationContext, input): Promise<ComponentProps<typeof RecapScreen>> => {
      const { user, app } = operationContext;

      const { id: recapId = "" } = input;
      if (!z.uuid().safeParse(recapId).success) throw new AppError("MEDIA_NOT_FOUND");
      const lesson = await app
        .startRecap({
          userId: user.id,
          pair: pairOf(user.preferences),
          level: user.preferences.level,
          recapId,
        })
        .catch((error: unknown) => {
          if (isAppError(error)) throw new ViewRedirect("/review?tab=episodes");
          throw error;
        });

      return {
        view: {
          recapId,
          step: lesson.step + 1,
          steps: RECAP_STEPS,
          due: lesson.due,
          workTitle: lesson.info.workTitle,
          label: lesson.info.label,
          title: lesson.info.title,
          summary: lesson.info.summary,
          cards: lesson.info.cards,
          lesson: {
            episodeId: recapId,
            nodeIndex: 0,
            seed: lesson.seed,
            title: lesson.info.title,
            level: user.preferences.level,
            replay: !lesson.due,
            audioSpeed: user.preferences.audioSpeed,
            exercises: lesson.exercises,
            source: lesson.recap.source === "personal" ? "recap-personal" : "recap",
            backHref: "/review?tab=episodes",
          },
        },
      };
    },
  }),
};
