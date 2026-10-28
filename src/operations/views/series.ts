import { z } from "zod";
import type { ComponentProps } from "react";
import { pairOf } from "@/modules/identity";
import { operation } from "../operation";
import type { SeriesScreen } from "@/ui/series/series-screen";

export const seriesView = {
  "view.series": operation({
    input: z.undefined(),
    run: async (context, _input): Promise<ComponentProps<typeof SeriesScreen>> => {
      const { user, app } = context;

      const view = await app.getPersonalSeries({
        userId: user.id,
        pair: pairOf(user.preferences),
        userLevel: user.preferences.level,
      });

      return {
        view: {
          id: view.series.id,
          name: view.series.name,
          description: view.series.description,
          descriptionUpdatedAt: view.series.descriptionUpdatedAt?.toISOString() ?? null,
          descriptionBasis: view.series.descriptionBasis,
          level: view.series.level,
          userLevel: user.preferences.level,
          activeLevel: view.activeLevel,
          seasons: view.seasons.map((season) => ({
            id: season.id,
            number: season.number,
            level: season.level,
            episodes: season.episodes.map((episode) => ({
              id: episode.id,
              number: episode.number,
              title: episode.title,
              cardCount: episode.cardCount,
              sourceCount: episode.sourceCount,
              progress: episode.progress,
              fresh: episode.fresh,
            })),
          })),
          upcoming: view.upcoming,
        },
      };
    },
  }),
};
