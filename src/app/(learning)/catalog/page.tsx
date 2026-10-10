import { getContainer } from "@/infrastructure/container";
import { posterUrl, type MediaItem } from "@/modules/catalog";
import { fitFor } from "@/shared/levels";
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
  const overview = await getContainer().getCatalogOverview(user.id);
  return (
    <CatalogScreen
      tiles={overview.entries.map(({ media }) => ({
        ...toPoster(media),
        id: media.id,
        fit: fitFor(user.preferences.level, media.levelMin, media.levelMax),
        levelRange: levelRange(media),
      }))}
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
