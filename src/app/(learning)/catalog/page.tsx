import { getTranslations } from "next-intl/server";
import { getContainer } from "@/infrastructure/container";
import { posterUrl, type MediaItem } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { fitLabel, parseLearnerInsight, parseLocalReason } from "@/modules/recommendations";
import { posterColorsFor } from "@/modules/catalog";
import { fitFor, levelIndex } from "@/shared/levels";
import { CatalogScreen } from "@/ui/catalog/catalog-screen";
import type { PosterData } from "@/ui/catalog/poster";
import { scheduleJob } from "../../schedule";
import { requireUser } from "../../session";

const levelRange = (media: MediaItem): string => `${media.levelMin}–${media.levelMax}`;

function toPoster(media: MediaItem): PosterData {
  return {
    title: media.title,
    type: media.type,
    year: media.year,
    posterUrl: posterUrl(media.posterPath),
    posterColors: media.posterColors,
    levelRange: levelRange(media),
  };
}

export default async function CatalogPage() {
  const user = await requireUser();
  const container = getContainer();
  const level = user.preferences.level;
  const pair = pairOf(user.preferences);
  const [overview, recommendations] = await Promise.all([
    container.getCatalogOverview(user.id),
    container.getRecommendations({ userId: user.id, level, language: pair.target }),
  ]);
  if (recommendations.refresh) {
    await scheduleJob(
      container,
      "refresh_recommendations",
      { userId: user.id, level, language: pair.target },
      user.id,
    );
  }
  const t = await getTranslations("suggestions");
  const insight = parseLearnerInsight(recommendations.insight);
  const insightText = insight
    ? (() => {
        const facts = [
          insight.accuracyPercent === null ? null : t("facts.accuracy", { percent: insight.accuracyPercent }),
          insight.againPercent === null ? null : t("facts.again", { percent: insight.againPercent }),
          insight.marksPerHundred === null ? null : t("facts.marks", { count: insight.marksPerHundred }),
        ].filter((fact): fact is string => fact !== null);
        if (facts.length === 0) return t("insight.littleData");
        return `${t("insight.summary", { facts: facts.join(", ") })} ${t(`insight.${insight.challenge}`)}`;
      })()
    : recommendations.insight;
  const reasonText = (reason: string): string => {
    if (recommendations.writtenByAi) return reason;
    const local = parseLocalReason(reason);
    if (!local) return reason;
    const opening = local.relatedTitle
      ? t("reason.related", { title: local.relatedTitle })
      : t("reason.trending");
    return `${opening}, ${t(`reason.${local.fit}`)}`;
  };
  return (
    <CatalogScreen
      tiles={overview.entries.map(({ media }) => ({
        ...toPoster(media),
        id: media.id,
        fit: fitFor(user.preferences.level, media.levelMin, media.levelMax),
        levelRange: levelRange(media),
        originalLanguage: media.originalLanguage,
      }))}
      suggestions={{
        status: recommendations.status,
        insight: insightText,
        writtenByAi: recommendations.writtenByAi,
        updating: recommendations.updating,
        items: recommendations.items.map((item) => ({
          workKey: item.workKey,
          poster: {
            title: item.title,
            type: item.type,
            year: item.year,
            posterUrl: posterUrl(item.posterPath),
            posterColors: posterColorsFor(item.title),
          },
          overview: item.overview,
          genres: item.genres,
          reason: reasonText(item.reason),
          levelRange: `${item.levelMin}–${item.levelMax}`,
          fit: fitLabel(levelIndex(level), item.levelMin, item.levelMax),
        })),
      }}
      inProgress={overview.inProgress.map((entry) => ({
        episodeId: entry.episodeId,
        mediaId: entry.mediaId,
        poster: toPoster(entry.media),
        label: entry.label,
        episodeTitle: entry.episodeTitle,
        progressPercent: entry.progressPercent,
      }))}
    />
  );
}
