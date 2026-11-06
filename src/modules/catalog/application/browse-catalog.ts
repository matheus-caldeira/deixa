import { AppError } from "@/shared/errors";
import { episodeLabel, type Episode, type MediaItem, type Season } from "../domain/catalog";
import type { CatalogEntry, CatalogRepository, EpisodeProgressRepository } from "./ports";

const COMPLETE = 100;

export type InProgressEntry = {
  episodeId: string;
  mediaId: string;
  media: MediaItem;
  label: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  progressPercent: number;
};

export type CatalogOverview = { entries: CatalogEntry[]; inProgress: InProgressEntry[] };

export function makeGetCatalogOverview(deps: {
  catalog: CatalogRepository;
  progress: EpisodeProgressRepository;
}) {
  return async function getCatalogOverview(userId: string): Promise<CatalogOverview> {
    const [entries, progress] = await Promise.all([
      deps.catalog.listCatalog(),
      deps.progress.listForUser(userId),
    ]);
    const unfinished = progress.filter((entry) => entry.progressPercent < COMPLETE);
    const contexts = await Promise.all(
      unfinished.map((entry) => deps.catalog.findEpisodeContext(entry.episodeId)),
    );
    const inProgress = unfinished.flatMap((entry, index) => {
      const context = contexts[index];
      if (!context) return [];
      return [
        {
          episodeId: entry.episodeId,
          mediaId: context.media.id,
          media: context.media,
          label: episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber),
          seasonNumber: context.season.seasonNumber,
          episodeNumber: context.episode.episodeNumber,
          episodeTitle: context.episode.title,
          progressPercent: entry.progressPercent,
        },
      ];
    });
    return {
      entries: entries.filter((entry) => entry.media.type !== "music"),
      inProgress: inProgress.filter((entry) => entry.media.type !== "music"),
    };
  };
}

export type MediaDetail = {
  media: MediaItem;
  seasons: (Season & { episodes: (Episode & { progressPercent: number | null })[] })[];
};

export function makeGetMediaDetail(deps: {
  catalog: CatalogRepository;
  progress: EpisodeProgressRepository;
}) {
  return async function getMediaDetail(userId: string, mediaId: string): Promise<MediaDetail> {
    const media = await deps.catalog.findMediaById(mediaId);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    const [seasons, episodes, progress] = await Promise.all([
      deps.catalog.listSeasons(mediaId),
      deps.catalog.listEpisodesByMedia(mediaId),
      deps.progress.listForUser(userId),
    ]);
    const percentByEpisode = new Map(progress.map((entry) => [entry.episodeId, entry.progressPercent]));
    return {
      media,
      seasons: seasons
        .map((season) => ({
          ...season,
          episodes: episodes
            .filter((episode) => episode.seasonId === season.id)
            .map((episode) => ({ ...episode, progressPercent: percentByEpisode.get(episode.id) ?? null })),
        }))
        .filter((season) => season.episodes.length > 0),
    };
  };
}

export function makeGetEpisodeContext(deps: { catalog: CatalogRepository }) {
  return async function getEpisodeContext(episodeId: string) {
    return deps.catalog.findEpisodeContext(episodeId);
  };
}

export function makeStartEpisode(deps: {
  catalog: CatalogRepository;
  progress: EpisodeProgressRepository;
  clock: { now(): Date };
}) {
  return async function startEpisode(userId: string, episodeId: string): Promise<void> {
    const context = await deps.catalog.findEpisodeContext(episodeId);
    if (!context) throw new AppError("EPISODE_NOT_FOUND");
    const known = (await deps.progress.listForUser(userId)).find((entry) => entry.episodeId === episodeId);
    if (!known) await deps.progress.upsert(userId, episodeId, 0, deps.clock.now());
  };
}
