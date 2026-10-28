import { z } from "zod";
import { pairOf } from "@/modules/identity";
import { RECAP_STEPS } from "@/modules/study";
import type { RecapListItem } from "@/ui/review/recap-list";
import type { ReviewView } from "@/ui/review/review-screen";
import { operation } from "../operation";

export type ReviewPageView =
  | { tab: "episodes"; dueCards: number; dueEpisodes: number; items: RecapListItem[] }
  | { tab: "cards"; dueEpisodes: number; view: ReviewView };

export const reviewView = {
  "view.review": operation({
    input: z.object({ tab: z.string().optional() }),
    run: async ({ user, app }, input): Promise<ReviewPageView> => {
      const pair = pairOf(user.preferences);
      if (input.tab === "episodes") {
        const [recaps, dueCards] = await Promise.all([
          app.listRecaps({ userId: user.id, pair }),
          app.countDueCards(user.id, pair),
        ]);
        return {
          tab: "episodes",
          dueCards,
          dueEpisodes: recaps.filter((recap) => recap.due).length,
          items: recaps.map((recap) => ({
            id: recap.id,
            workTitle: recap.info.workTitle,
            label: recap.info.label,
            title: recap.info.title,
            step: recap.step,
            steps: RECAP_STEPS,
            due: recap.due,
            inDays: recap.inDays,
          })),
        };
      }
      const [queue, anticipation, summary, dueRecaps] = await Promise.all([
        app.listDueCards(user.id, pair),
        app.getAnticipationStatus(user.id, user.preferences.timezone, pair),
        app.getProfileSummary({
          userId: user.id,
          dailyGoal: user.preferences.dailyGoal,
          timezone: user.preferences.timezone,
          language: pair.target,
        }),
        app.countDueRecaps({ userId: user.id, pair }),
      ]);
      return {
        tab: "cards",
        dueEpisodes: dueRecaps,
        view: {
          dueCount: queue.dueCount,
          anticipation: { available: anticipation.available, batchSize: anticipation.batchSize },
          audioSpeed: user.preferences.audioSpeed,
          recurringErrors: summary.recurringErrors,
          cards: queue.cards.map((card) => ({
            cardId: card.cardId,
            learningItemId: card.learningItemId,
            term: card.term,
            meaning: card.meaning,
            contextText: card.contextText,
            contextTranslation: card.contextTranslation,
            source: {
              mediaTitle: card.mediaTitle,
              mediaType: card.mediaType,
              seasonNumber: card.seasonNumber,
              episodeNumber: card.episodeNumber,
              sourceKind: card.sourceKind,
            },
            intervals: card.intervals,
          })),
        },
      };
    },
  }),
};
