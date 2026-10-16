"use client";

import { useTranslations } from "next-intl";

export type RecapLabelView =
  | { kind: "catalog"; mediaType: "series" | "movie"; season: number; episode: number }
  | { kind: "personal"; level: string; episode: number };

export function RecapLabelText({ label }: { label: RecapLabelView }) {
  const t = useTranslations("trail");
  if (label.kind === "personal")
    return <>{t("label.personal", { level: label.level, episode: label.episode })}</>;
  if (label.mediaType === "movie") return <>{t("label.movie")}</>;
  return <>{t("label.episode", { season: label.season, episode: label.episode })}</>;
}
