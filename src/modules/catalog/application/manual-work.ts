import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import {
  DEFAULT_LEVEL_RANGE,
  MOVIE_EPISODE_NUMBER,
  MOVIE_EPISODE_TITLE,
  MOVIE_SEASON_NUMBER,
  posterColorsFor,
  type MediaType,
} from "../domain/catalog";
import type { CatalogRepository } from "./ports";

const MAX_TITLE_LENGTH = 120;
const MAX_NUMBER = 999;

type Deps = { catalog: CatalogRepository; clock: Clock; ids: IdGenerator };

function assertNumber(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_NUMBER) throw new AppError("INVALID_INPUT");
}

export function makeEnsureManualEpisode(deps: Deps) {
  return async function ensureManualEpisode(input: {
    mediaId: string;
    seasonNumber: number;
    episodeNumber: number;
  }): Promise<{ episodeId: string }> {
    const media = await deps.catalog.findMediaById(input.mediaId);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    const seasonNumber = media.type === "movie" ? MOVIE_SEASON_NUMBER : input.seasonNumber;
    const episodeNumber = media.type === "movie" ? MOVIE_EPISODE_NUMBER : input.episodeNumber;
    if (media.type === "series") {
      assertNumber(seasonNumber);
      assertNumber(episodeNumber);
    }
    await deps.catalog.upsertSeasons(media.id, [
      {
        id: deps.ids.next(),
        seasonNumber,
        title: media.type === "movie" ? "Filme" : `Temporada ${seasonNumber}`,
        episodeCount: null,
      },
    ]);
    const season = (await deps.catalog.listSeasons(media.id)).find(
      (candidate) => candidate.seasonNumber === seasonNumber,
    );
    if (!season) throw new AppError("SEASON_NOT_FOUND");
    const known = (await deps.catalog.listEpisodes(season.id)).find(
      (episode) => episode.episodeNumber === episodeNumber,
    );
    if (known) return { episodeId: known.id };
    const episodeId = deps.ids.next();
    await deps.catalog.upsertEpisodes(
      season.id,
      [
        {
          id: episodeId,
          episodeNumber,
          title: media.type === "movie" ? MOVIE_EPISODE_TITLE : `Episódio ${episodeNumber}`,
          overview: "",
          durationSeconds: null,
        },
      ],
      null,
    );
    return { episodeId };
  };
}

export function makeCreateManualWork(deps: Deps) {
  return async function createManualWork(input: {
    userId: string;
    title: string;
    type: MediaType;
    year: number | null;
  }): Promise<{ mediaId: string }> {
    const title = input.title.trim();
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) throw new AppError("INVALID_INPUT");
    const id = deps.ids.next();
    const now = deps.clock.now();
    const [levelMin, levelMax] = DEFAULT_LEVEL_RANGE;
    const mediaId = await deps.catalog.upsertMedia({
      id,
      type: input.type,
      title,
      originalTitle: title,
      overview: "",
      year: input.year,
      metadataProvider: "manual",
      externalId: id,
      posterPath: null,
      posterColors: posterColorsFor(title),
      levelMin,
      levelMax,
      accent: null,
      createdBy: input.userId,
      syncedAt: null,
      createdAt: now,
    });
    return { mediaId };
  };
}
