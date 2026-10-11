import { getContainer } from "@/infrastructure/container";
import { ReviewScreen } from "@/ui/review/review-screen";
import { requireUser } from "../../session";

export default async function ReviewPage() {
  const user = await requireUser();
  const container = getContainer();
  const [queue, anticipation, summary] = await Promise.all([
    container.listDueCards(user.id),
    container.getAnticipationStatus(user.id, user.preferences.timezone),
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
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
          sourceLabel: card.sourceLabel,
          intervals: card.intervals,
        })),
      }}
    />
  );
}
