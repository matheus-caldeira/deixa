import { DEFAULT_TARGET_LANGUAGE, normalizeLanguageTag } from "@/shared/study-languages";
import { AppError, isAppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import {
  DEFAULT_LEVEL_RANGE,
  MOVIE_EPISODE_NUMBER,
  MOVIE_EPISODE_TITLE,
  MOVIE_SEASON_NUMBER,
  isMetadataStale,
  posterColorsFor,
  type MediaItem,
  type MediaType,
} from "../domain/catalog";
import type { CatalogRepository, MetadataProvider, WorkDetails } from "./ports";

const SECONDS_PER_MINUTE = 60;
const FIRST_REGULAR_SEASON = 1;

type Deps = { catalog: CatalogRepository; metadata: MetadataProvider; clock: Clock; ids: IdGenerator };

async function storeWork(
  deps: Deps,
  details: WorkDetails,
  existing: MediaItem | null,
  userId: string | null,
) {
  const now = deps.clock.now();
  const known = details.levelRange ?? null;
  const [levelMin, levelMax] =
    known ?? (existing ? ([existing.levelMin, existing.levelMax] as const) : DEFAULT_LEVEL_RANGE);
  const mediaId = await deps.catalog.upsertMedia({
    id: existing?.id ?? deps.ids.next(),
    type: details.type,
    title: details.title,
    originalTitle: details.originalTitle,
    overview: details.overview,
    year: details.year,
    metadataProvider: details.provider,
    externalId: details.externalId,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath ?? null,
    posterColors: details.posterColors ?? posterColorsFor(details.title),
    levelMin,
    levelMax,
    accent: existing?.accent ?? details.accent ?? null,
    originalLanguage:
      existing?.originalLanguage ??
      normalizeLanguageTag(details.originalLanguage ?? "") ??
      DEFAULT_TARGET_LANGUAGE,
    genres: details.genres.length > 0 ? details.genres : (existing?.genres ?? []),
    createdBy: userId,
    syncedAt: now,
    createdAt: now,
  });
  if (existing && known && (existing.levelMin !== levelMin || existing.levelMax !== levelMax)) {
    await deps.catalog.updateLevelRange(mediaId, known);
  }

  if (details.type === "movie") {
    await deps.catalog.upsertSeasons(mediaId, [
      { id: deps.ids.next(), seasonNumber: MOVIE_SEASON_NUMBER, title: "Filme", episodeCount: 1 },
    ]);
    const [season] = await deps.catalog.listSeasons(mediaId);
    if (season) {
      await deps.catalog.upsertEpisodes(
        season.id,
        [
          {
            id: deps.ids.next(),
            episodeNumber: MOVIE_EPISODE_NUMBER,
            title: MOVIE_EPISODE_TITLE,
            overview: details.overview,
            durationSeconds: details.runtimeMinutes ? details.runtimeMinutes * SECONDS_PER_MINUTE : null,
            stillPath: details.backdropPath ?? null,
          },
        ],
        now,
      );
    }
    return mediaId;
  }

  await deps.catalog.upsertSeasons(
    mediaId,
    details.seasons
      .filter((season) => season.seasonNumber >= FIRST_REGULAR_SEASON)
      .map((season) => ({ id: deps.ids.next(), ...season })),
  );
  return mediaId;
}

export function makeRegisterWork(deps: Deps) {
  return async function registerWork(input: {
    userId: string | null;
    type: MediaType;
    externalId: string;
    force?: boolean;
  }): Promise<{ mediaId: string; fetched: boolean }> {
    const existing = await deps.catalog.findMediaByExternal(deps.metadata.name, input.externalId);
    if (existing && !input.force && !isMetadataStale(existing.metadataSyncedAt, deps.clock.now())) {
      return { mediaId: existing.id, fetched: false };
    }
    if (existing && existing.type !== input.type) throw new AppError("MEDIA_NOT_FOUND");
    try {
      const details = await deps.metadata.getWork(input.type, input.externalId);
      if (details.type !== input.type || details.externalId !== input.externalId) {
        throw new AppError("METADATA_NOT_FOUND");
      }
      return { mediaId: await storeWork(deps, details, existing, input.userId), fetched: true };
    } catch (error) {
      if (existing && !isAppError(error)) return { mediaId: existing.id, fetched: false };
      if (existing && isAppError(error) && error.code === "METADATA_UNAVAILABLE") {
        return { mediaId: existing.id, fetched: false };
      }
      throw error;
    }
  };
}

export function makeRefreshWork(deps: Deps) {
  const registerWork = makeRegisterWork(deps);
  return async function refreshWork(input: {
    mediaId: string;
    force: boolean;
  }): Promise<{ refreshed: boolean }> {
    const media = await deps.catalog.findMediaById(input.mediaId);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    if (media.metadataProvider !== deps.metadata.name) return { refreshed: false };
    if (!input.force && !isMetadataStale(media.metadataSyncedAt, deps.clock.now()))
      return { refreshed: false };
    const result = await registerWork({
      userId: null,
      type: media.type,
      externalId: media.externalId,
      force: true,
    });
    return { refreshed: result.fetched };
  };
}
