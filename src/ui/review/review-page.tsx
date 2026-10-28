"use client";

import { useTranslations } from "next-intl";
import type { ReviewPageView } from "@/operations/views/review";
import { RecapList } from "./recap-list";
import { ReviewScreen } from "./review-screen";
import { ReviewTabs } from "./review-tabs";

export function ReviewPage({ page }: { page: ReviewPageView }) {
  const t = useTranslations("review");
  if (page.tab === "episodes") {
    return (
      <>
        <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
        <ReviewTabs active="episodes" cards={page.dueCards} episodes={page.dueEpisodes} />
        <RecapList items={page.items} />
      </>
    );
  }
  return (
    <ReviewScreen
      key={page.view.cards.map((card) => card.cardId).join(",")}
      tabs={<ReviewTabs active="cards" cards={page.view.dueCount} episodes={page.dueEpisodes} />}
      view={page.view}
    />
  );
}
