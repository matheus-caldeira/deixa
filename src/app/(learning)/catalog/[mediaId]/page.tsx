import { notFound } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { logger } from "@/infrastructure/logger/logger";
import { backdropUrl, posterUrl, stillUrl } from "@/modules/catalog";
import { isAppError } from "@/shared/errors";
import { fitFor } from "@/shared/levels";
import { MediaDetailScreen } from "@/ui/catalog/media-detail-screen";
import { requireUser } from "../../../session";

const SECONDS_PER_MINUTE = 60;

export default async function MediaDetailPage(props: {
  params: Promise<{ mediaId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const user = await requireUser();
  const { mediaId } = await props.params;
  const { season } = await props.searchParams;
  if (!z.uuid().safeParse(mediaId).success) notFound();
  const container = getContainer();

  await container.refreshWork({ mediaId, force: false }).catch((error: unknown) => {
    if (isAppError(error) && error.code === "MEDIA_NOT_FOUND") notFound();
    logger.warn("catalog.refresh_skipped", {
      reason: error instanceof Error ? error.message : "desconhecido",
    });
  });
  const detail = await container.getMediaDetail(user.id, mediaId).catch((error: unknown) => {
    if (isAppError(error) && error.code === "MEDIA_NOT_FOUND") notFound();
    throw error;
  });
  const { media } = detail;
  const allSeasons = (await container.listSeasons(mediaId)).filter(
    (entry) => media.type === "movie" || entry.seasonNumber >= 1,
  );
  const requested = Number(season);
  const fallback = detail.seasons[0]?.seasonNumber ?? allSeasons[0]?.seasonNumber ?? null;
  const seasonNumber = allSeasons.some((entry) => entry.seasonNumber === requested) ? requested : fallback;
  let episodes = detail.seasons.find((entry) => entry.seasonNumber === seasonNumber)?.episodes ?? [];
  if (episodes.length === 0 && seasonNumber !== null) {
    const loaded = await container.loadSeasonEpisodes({ mediaId, seasonNumber }).catch((error: unknown) => {
      logger.warn("catalog.season_load_failed", {
        reason: error instanceof Error ? error.message : "desconhecido",
      });
      return null;
    });
    episodes = (loaded?.episodes ?? []).map((episode) => ({ ...episode, progressPercent: null }));
  }

  return (
    <MediaDetailScreen
      key={`${media.id}:${seasonNumber ?? ""}`}
      media={{
        id: media.id,
        poster: {
          title: media.title,
          type: media.type,
          year: media.year,
          posterUrl: posterUrl(media.posterPath),
          posterColors: media.posterColors,
        },
        backdropUrl: backdropUrl(media.backdropPath),
        overview: media.overview,
        fit: fitFor(user.preferences.level, media.levelMin, media.levelMax),
        levelRange: `${media.levelMin}–${media.levelMax}`,
        accent: media.accent,
        uploaderName: media.uploaderName,
        canRefresh: media.metadataProvider === container.providers.metadata,
        seasonNumber,
        seasons: allSeasons.map((entry) => ({
          seasonNumber: entry.seasonNumber,
          title: entry.title,
          episodeCount: entry.episodeCount,
        })),
        episodes: episodes.map((episode) => ({
          id: episode.id,
          episodeNumber: episode.episodeNumber,
          title: episode.title,
          status: episode.status,
          cueCount: episode.cueCount,
          hasPortuguese: episode.hasPortuguese,
          durationMinutes: episode.durationSeconds
            ? Math.round(episode.durationSeconds / SECONDS_PER_MINUTE)
            : null,
          progressPercent: episode.progressPercent,
          failureReason: episode.failureReason,
          stillUrl: stillUrl(episode.stillPath),
        })),
      }}
    />
  );
}
