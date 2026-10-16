"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type ReviewTab = "cards" | "episodes";

export function ReviewTabs({
  active,
  cards,
  episodes,
}: {
  active: ReviewTab;
  cards: number;
  episodes: number;
}) {
  const t = useTranslations("recap");
  return (
    <nav className="seg" aria-label={t("tabs")}>
      <Link
        className={active === "cards" ? "on" : ""}
        href="/review"
        aria-current={active === "cards" ? "page" : undefined}
      >
        {t("cardsTab", { count: cards })}
      </Link>
      <Link
        className={active === "episodes" ? "on" : ""}
        href="/review?tab=episodes"
        aria-current={active === "episodes" ? "page" : undefined}
      >
        {t("episodesTab", { count: episodes })}
      </Link>
    </nav>
  );
}
