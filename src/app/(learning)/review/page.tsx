import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { ReviewScreen } from "@/ui/review/review-screen";
import { requireUser } from "../../session";

export default async function ReviewPage() {
  const user = await requireUser();
  const container = getContainer();
  const pair = pairOf(user.preferences);
  const [queue, anticipation, summary] = await Promise.all([
    container.listDueCards(user.id, pair),
    container.getAnticipationStatus(user.id, user.preferences.timezone, pair),
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
      language: pair.target,
    }),
  ]);
  return (
    <ReviewScreen
      key={queue.cards.map((card) => card.cardId).join(",")}
      view={{
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
      }}
    />
  );
}
