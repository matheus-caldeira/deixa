import { z } from "zod";
import type { ComponentProps } from "react";
import { pairOf } from "@/modules/identity";
import { AppError, isAppError } from "@/shared/errors";
import { operation } from "../operation";
import type { EpisodeTrailScreen } from "@/ui/series/episode-trail-screen";

export const seriesEpisodeView = {
  "view.seriesEpisode": operation({
    input: z.object({ id: z.string().optional() }),
    run: async (context, input): Promise<ComponentProps<typeof EpisodeTrailScreen>> => {
      const { user, app } = context;

      const { id: episodeId = "" } = input;
      const trail = await app
        .getPersonalEpisodeTrail({ userId: user.id, pair: pairOf(user.preferences), episodeId })
        .catch((error: unknown) => {
          if (isAppError(error)) throw new AppError("MEDIA_NOT_FOUND");
          throw error;
        });

      return {
        view: {
          id: trail.episode.id,
          title: trail.episode.title,
          number: trail.episode.number,
          seasonNumber: trail.season.number,
          seasonLevel: trail.season.level,
          seriesName: trail.seriesName,
          cardCount: trail.episode.cardCount,
          progress: trail.progress,
          nodes: trail.nodes,
          sources: trail.sources.map((source) => ({
            sessionId: source.sessionId,
            themeId: source.themeId,
            themeTitle: source.themeTitle,
            closedAt: source.closedAt?.toISOString() ?? null,
          })),
        },
      };
    },
  }),
};
