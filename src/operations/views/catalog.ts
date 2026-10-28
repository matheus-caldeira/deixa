import { z } from "zod";
import type { ComponentProps } from "react";
import { posterUrl, type MediaItem } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { nextEpisodeId } from "@/modules/personal-series";
import { fitLabel, parseLearnerInsight, parseLocalReason } from "@/modules/recommendations";
import { posterColorsFor } from "@/modules/catalog";
import { fitFor, levelIndex } from "@/shared/levels";
import type { PosterData } from "@/ui/catalog/poster";
import { operation } from "../operation";
import type { CatalogScreen } from "@/ui/catalog/catalog-screen";

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

export const catalogView = {
  "view.catalog": operation({
    input: z.undefined(),
    run: async (context, _input): Promise<ComponentProps<typeof CatalogScreen>> => {
      const { user, app, translator, schedule } = context;

      const level = user.preferences.level;
      const pair = pairOf(user.preferences);
      const [overview, recommendations, personal] = await Promise.all([
        app.getCatalogOverview(user.id),
        app.getRecommendations({ userId: user.id, level, language: pair.target }),
        app.getPersonalSeries({ userId: user.id, pair, userLevel: level }),
      ]);
      const trail = await translator("trail");
      const personalName = personal.series.name ?? trail("personalName");
      const activeSeason = personal.seasons.find((season) => season.level === personal.activeLevel);
      const nextPersonalId = activeSeason ? nextEpisodeId(activeSeason.episodes) : null;
      const nextPersonal = activeSeason?.episodes.find((episode) => episode.id === nextPersonalId) ?? null;
      if (recommendations.refresh) {
        await schedule("refresh_recommendations", { userId: user.id, level, language: pair.target });
      }
      const t = await translator("suggestions");
      const insight = parseLearnerInsight(recommendations.insight);
      const insightText = insight
        ? (() => {
            const facts = [
              insight.accuracyPercent === null
                ? null
                : t("facts.accuracy", { percent: insight.accuracyPercent }),
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

      return {
        tiles: overview.entries.map(({ media }) => ({
          ...toPoster(media),
          id: media.id,
          fit: fitFor(user.preferences.level, media.levelMin, media.levelMax),
          levelRange: levelRange(media),
          originalLanguage: media.originalLanguage,
        })),
        suggestions: {
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
        },
        personal: {
          name: personalName,
          subtitle:
            nextPersonal && activeSeason
              ? `${trail("label.personal", { level: activeSeason.level, episode: nextPersonal.number })} · ${nextPersonal.title}`
              : trail("personalEmpty"),
          progressPercent: nextPersonal?.progress ?? 0,
          poster: {
            title: personalName,
            type: "series",
            year: null,
            posterUrl: null,
            posterColors: posterColorsFor(personalName),
          },
        },
        inProgress: overview.inProgress.map((entry) => ({
          episodeId: entry.episodeId,
          mediaId: entry.mediaId,
          seasonNumber: entry.seasonNumber,
          poster: toPoster(entry.media),
          label: entry.label,
          episodeTitle: entry.episodeTitle,
          progressPercent: entry.progressPercent,
        })),
      };
    },
  }),
};
