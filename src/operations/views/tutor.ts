import { z } from "zod";
import type { ComponentProps } from "react";
import { THEMES } from "@/modules/conversations";
import { pairOf } from "@/modules/identity";
import { operation } from "../operation";
import type { TalkScreen } from "@/ui/talk/talk-screen";

export const tutorView = {
  "view.tutor": operation({
    input: z.undefined(),
    run: async (context, _input): Promise<ComponentProps<typeof TalkScreen>> => {
      const { user, app } = context;

      const [recent, simulated, learner, series] = await Promise.all([
        app.listConversations(user.id, user.preferences.targetLanguage),
        app.isTutorSimulated(user.id),
        app.getLearnerProfile(user.id, user.preferences.targetLanguage),
        app.getPersonalSeries({
          userId: user.id,
          pair: pairOf(user.preferences),
          userLevel: user.preferences.level,
        }),
      ]);
      const seriesEpisodes = series.seasons.flatMap((season) => season.episodes);

      return {
        simulated,
        learner: {
          improvements: learner.improvements,
          strengths: learner.strengths,
          mistakes: learner.mistakes,
        },
        series: {
          name: series.series.name,
          episodes: seriesEpisodes.length,
          cards: seriesEpisodes.reduce((sum, episode) => sum + episode.cardCount, 0),
        },
        themes: THEMES.map((theme) => ({ id: theme.id, icon: theme.icon })),
        recent: recent.map((session) => ({
          id: session.id,
          themeId: session.themeId,
          title: session.themeTitle,
          turnCount: session.turnCount,
          closed: session.closedAt !== null,
          reviewStatus: session.reviewStatus,
          score: session.review?.score ?? null,
        })),
      };
    },
  }),
};
