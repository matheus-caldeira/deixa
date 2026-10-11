import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { isMetadataStale, type Episode } from "../domain/catalog";
import type { CatalogRepository, MetadataProvider } from "./ports";

const SECONDS_PER_MINUTE = 60;

export function makeLoadSeasonEpisodes(deps: {
  catalog: CatalogRepository;
  metadata: MetadataProvider;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function loadSeasonEpisodes(input: {
    mediaId: string;
    seasonNumber: number;
    force?: boolean;
  }): Promise<{ seasonId: string; episodes: Episode[] }> {
    const media = await deps.catalog.findMediaById(input.mediaId);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    const season = (await deps.catalog.listSeasons(media.id)).find(
      (candidate) => candidate.seasonNumber === input.seasonNumber,
    );
    if (!season) throw new AppError("SEASON_NOT_FOUND");

    const comesFromActiveProvider = media.metadataProvider === deps.metadata.name;
    const needsSync = input.force || isMetadataStale(season.episodesSyncedAt, deps.clock.now());
    if (comesFromActiveProvider && media.type === "series" && needsSync) {
      try {
        const fetched = await deps.metadata.getSeasonEpisodes(media.externalId, season.seasonNumber);
        await deps.catalog.upsertEpisodes(
          season.id,
          fetched.map((episode) => ({
            id: deps.ids.next(),
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            overview: episode.overview,
            durationSeconds: episode.runtimeMinutes ? episode.runtimeMinutes * SECONDS_PER_MINUTE : null,
            stillPath: episode.stillPath ?? null,
          })),
          deps.clock.now(),
        );
      } catch (error) {
        const known = await deps.catalog.listEpisodes(season.id);
        if (known.length === 0) throw error;
        return { seasonId: season.id, episodes: known };
      }
    }
    return { seasonId: season.id, episodes: await deps.catalog.listEpisodes(season.id) };
  };
}
