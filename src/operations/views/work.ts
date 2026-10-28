import { z } from "zod";
import type { ComponentProps } from "react";
import { logger } from "@/infrastructure/logger/logger";
import { backdropUrl, posterUrl, stillUrl } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { AppError, isAppError } from "@/shared/errors";
import { fitFor } from "@/shared/levels";
import { operation } from "../operation";
import type { MediaDetailScreen } from "@/ui/catalog/media-detail-screen";

const SECONDS_PER_MINUTE = 60;

export const workView = {
  "view.work": operation({
    input: z.object({ id: z.string().optional(), season: z.string().optional() }),
    run: async (
      operationContext,
      input,
    ): Promise<ComponentProps<typeof MediaDetailScreen> & { viewKey: string }> => {
      const { user, app } = operationContext;

      const { id: mediaId = "", season } = input;
      if (!z.uuid().safeParse(mediaId).success) throw new AppError("MEDIA_NOT_FOUND");

      await app.refreshWork({ userId: user.id, mediaId, force: false }).catch((error: unknown) => {
        if (isAppError(error) && error.code === "MEDIA_NOT_FOUND") throw new AppError("MEDIA_NOT_FOUND");
        logger.warn("catalog.refresh_skipped", {
          reason: error instanceof Error ? error.message : "unknown",
        });
      });
      const detail = await app.getMediaDetail(user.id, mediaId).catch((error: unknown) => {
        if (isAppError(error) && error.code === "MEDIA_NOT_FOUND") throw new AppError("MEDIA_NOT_FOUND");
        throw error;
      });
      const { media } = detail;
      const levelRatings = await app.getWorkLevelRatings({ mediaId });
      const allSeasons = (await app.listSeasons(mediaId)).filter(
        (entry) => media.type === "movie" || entry.seasonNumber >= 1,
      );
      const requested = Number(season);
      const fallback = detail.seasons[0]?.seasonNumber ?? allSeasons[0]?.seasonNumber ?? null;
      const seasonNumber = allSeasons.some((entry) => entry.seasonNumber === requested)
        ? requested
        : fallback;
      let episodes = detail.seasons.find((entry) => entry.seasonNumber === seasonNumber)?.episodes ?? [];
      if (episodes.length === 0 && seasonNumber !== null) {
        const loaded = await app
          .loadSeasonEpisodes({ userId: user.id, mediaId, seasonNumber })
          .catch((error: unknown) => {
            logger.warn("catalog.season_load_failed", {
              reason: error instanceof Error ? error.message : "unknown",
            });
            return null;
          });
        episodes = (loaded?.episodes ?? []).map((episode) => ({ ...episode, progressPercent: null }));
      }

      return {
        viewKey: `${media.id}:${seasonNumber ?? ""}`,
        media: {
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
          levelRatings: levelRatings.ratings.map((rating) => ({
            kind: rating.kind,
            source: rating.sourceName,
            range: `${rating.range[0]}–${rating.range[1]}`,
          })),
          accent: media.accent,
          uploaderName: media.uploaderName,
          canRefresh: media.metadataProvider === (await app.metadataNameFor(user.id)),
          seasonNumber,
          pair: pairOf(user.preferences),
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
            subtitleLanguages: episode.subtitleLanguages,
            durationMinutes: episode.durationSeconds
              ? Math.round(episode.durationSeconds / SECONDS_PER_MINUTE)
              : null,
            progressPercent: episode.progressPercent,
            failureReason: episode.failureReason,
            stillUrl: stillUrl(episode.stillPath),
          })),
        },
      };
    },
  }),
};
