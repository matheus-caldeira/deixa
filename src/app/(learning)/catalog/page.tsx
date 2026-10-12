import { after } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { posterUrl, type MediaItem } from "@/modules/catalog";
import { fitLabel } from "@/modules/recommendations";
import { posterColorsFor } from "@/modules/catalog";
import { fitFor, levelIndex } from "@/shared/levels";
import { CatalogScreen } from "@/ui/catalog/catalog-screen";
import type { PosterData } from "@/ui/catalog/poster";
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
  const [overview, recommendations] = await Promise.all([
    container.getCatalogOverview(user.id),
    container.getRecommendations({ userId: user.id, level }),
  ]);
  if (recommendations.refresh) {
    after(() => container.refreshRecommendations({ userId: user.id, level }).catch(() => undefined));
  }
  return (
    <CatalogScreen
      tiles={overview.entries.map(({ media }) => ({
        ...toPoster(media),
        id: media.id,
        fit: fitFor(user.preferences.level, media.levelMin, media.levelMax),
        levelRange: levelRange(media),
      }))}
      suggestions={{
        status: recommendations.status,
        insight: recommendations.insight,
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
          reason: item.reason,
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
