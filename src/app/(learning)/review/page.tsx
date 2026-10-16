import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { RecapList } from "@/ui/review/recap-list";
import { ReviewScreen } from "@/ui/review/review-screen";
import { ReviewTabs } from "@/ui/review/review-tabs";
import { RECAP_STEPS } from "@/modules/study";
import { getTranslations } from "next-intl/server";
import { requireUser } from "../../session";

export default async function ReviewPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const container = getContainer();
  const pair = pairOf(user.preferences);
  const { tab } = await props.searchParams;
  if (tab === "episodes") {
    const [recaps, dueCards, t] = await Promise.all([
      container.listRecaps({ userId: user.id, pair }),
      container.countDueCards(user.id, pair),
      getTranslations("review"),
    ]);
    return (
      <>
        <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
        <ReviewTabs
          active="episodes"
          cards={dueCards}
          episodes={recaps.filter((recap) => recap.due).length}
        />
        <RecapList
          items={recaps.map((recap) => ({
            id: recap.id,
            workTitle: recap.info.workTitle,
            label: recap.info.label,
            title: recap.info.title,
            step: recap.step,
            steps: RECAP_STEPS,
            due: recap.due,
            inDays: recap.inDays,
          }))}
        />
      </>
    );
  }
  const [queue, anticipation, summary, dueRecaps] = await Promise.all([
    container.listDueCards(user.id, pair),
    container.getAnticipationStatus(user.id, user.preferences.timezone, pair),
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
      language: pair.target,
    }),
    container.countDueRecaps({ userId: user.id, pair }),
  ]);
  return (
    <ReviewScreen
      key={queue.cards.map((card) => card.cardId).join(",")}
      tabs={<ReviewTabs active="cards" cards={queue.dueCount} episodes={dueRecaps} />}
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
