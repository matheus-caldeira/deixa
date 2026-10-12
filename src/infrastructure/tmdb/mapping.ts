import type { EpisodeMetadata, MediaType, WorkCandidate, WorkDetails, WorkSummary } from "@/modules/catalog";
import type {
  TmdbMovieDetails,
  TmdbSearchMulti,
  TmdbSeasonDetails,
  TmdbTvDetails,
  TmdbWorkList,
} from "./schemas";

const KIND_BY_TYPE = { series: "tv", movie: "movie" } as const;

export function tmdbExternalId(type: "series" | "movie", id: number | string): string {
  return `${KIND_BY_TYPE[type]}:${id}`;
}

export function tmdbNumericId(type: "series" | "movie", externalId: string): string | null {
  const [kind, id] = externalId.split(":");
  return kind === KIND_BY_TYPE[type] && id !== undefined && /^\d+$/.test(id) ? id : null;
}

const filled = (value: string | null | undefined): string => (value ?? "").trim();

function firstFilled(...values: (string | null | undefined)[]): string {
  return values.map(filled).find((value) => value.length > 0) ?? "";
}

function yearOf(date: string | null | undefined): number | null {
  const year = Number(filled(date).slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function needsEnglishFallback(fields: { title: string; overview: string }): boolean {
  return fields.title === "" || fields.overview === "";
}

export function mapSearchResults(localized: TmdbSearchMulti, english?: TmdbSearchMulti): WorkSummary[] {
  const englishById = new Map(
    (english?.results ?? []).map((result) => [`${result.media_type}:${result.id}`, result]),
  );
  return localized.results.flatMap((result) => {
    if (result.media_type !== "tv" && result.media_type !== "movie") return [];
    const fallback = englishById.get(`${result.media_type}:${result.id}`);
    const isSeries = result.media_type === "tv";
    const originalTitle = firstFilled(
      isSeries ? result.original_name : result.original_title,
      isSeries ? fallback?.original_name : fallback?.original_title,
    );
    const title = firstFilled(
      isSeries ? result.name : result.title,
      isSeries ? fallback?.name : fallback?.title,
      originalTitle,
    );
    if (title === "") return [];
    return [
      {
        provider: "tmdb" as const,
        externalId: tmdbExternalId(isSeries ? "series" : "movie", result.id),
        type: isSeries ? ("series" as const) : ("movie" as const),
        title,
        originalTitle: originalTitle || title,
        overview: firstFilled(result.overview, fallback?.overview),
        year: yearOf(isSeries ? result.first_air_date : result.release_date),
        posterPath: firstFilled(result.poster_path, fallback?.poster_path) || null,
        backdropPath: firstFilled(result.backdrop_path, fallback?.backdrop_path) || null,
      },
    ];
  });
}

export function mapWorkList(
  type: MediaType,
  list: TmdbWorkList,
  genreNames: ReadonlyMap<number, string>,
): WorkCandidate[] {
  const isSeries = type === "series";
  return list.results.flatMap((result) => {
    const originalTitle = filled(isSeries ? result.original_name : result.original_title);
    const title = firstFilled(isSeries ? result.name : result.title, originalTitle);
    const overview = filled(result.overview);
    if (title === "" || overview === "") return [];
    return [
      {
        provider: "tmdb" as const,
        externalId: tmdbExternalId(type, result.id),
        type,
        title,
        originalTitle: originalTitle || title,
        overview,
        year: yearOf(isSeries ? result.first_air_date : result.release_date),
        posterPath: filled(result.poster_path) || null,
        backdropPath: filled(result.backdrop_path) || null,
        genres: (result.genre_ids ?? []).flatMap((id) => genreNames.get(id) ?? []),
        originalLanguage: filled(result.original_language) || null,
        popularity: result.popularity ?? 0,
      },
    ];
  });
}

export function mapTvDetails(localized: TmdbTvDetails, english?: TmdbTvDetails): WorkDetails {
  const originalTitle = firstFilled(localized.original_name, english?.original_name);
  const title = firstFilled(localized.name, english?.name, originalTitle);
  const englishSeasons = new Map((english?.seasons ?? []).map((season) => [season.season_number, season]));
  const runtime = localized.episode_run_time?.[0] ?? english?.episode_run_time?.[0] ?? null;
  return {
    provider: "tmdb",
    externalId: tmdbExternalId("series", localized.id),
    type: "series",
    title,
    originalTitle: originalTitle || title,
    overview: firstFilled(localized.overview, english?.overview),
    year: yearOf(localized.first_air_date ?? english?.first_air_date),
    posterPath: firstFilled(localized.poster_path, english?.poster_path) || null,
    backdropPath: firstFilled(localized.backdrop_path, english?.backdrop_path) || null,
    runtimeMinutes: runtime,
    seasons: localized.seasons.map((season) => ({
      seasonNumber: season.season_number,
      title: firstFilled(
        season.name,
        englishSeasons.get(season.season_number)?.name,
        `Temporada ${season.season_number}`,
      ),
      episodeCount: season.episode_count ?? null,
    })),
  };
}

export function mapMovieDetails(localized: TmdbMovieDetails, english?: TmdbMovieDetails): WorkDetails {
  const originalTitle = firstFilled(localized.original_title, english?.original_title);
  const title = firstFilled(localized.title, english?.title, originalTitle);
  return {
    provider: "tmdb",
    externalId: tmdbExternalId("movie", localized.id),
    type: "movie",
    title,
    originalTitle: originalTitle || title,
    overview: firstFilled(localized.overview, english?.overview),
    year: yearOf(localized.release_date ?? english?.release_date),
    posterPath: firstFilled(localized.poster_path, english?.poster_path) || null,
    backdropPath: firstFilled(localized.backdrop_path, english?.backdrop_path) || null,
    runtimeMinutes: localized.runtime ?? english?.runtime ?? null,
    seasons: [],
  };
}

export function mapSeasonEpisodes(
  localized: TmdbSeasonDetails,
  english?: TmdbSeasonDetails,
): EpisodeMetadata[] {
  const englishByNumber = new Map(
    (english?.episodes ?? []).map((episode) => [episode.episode_number, episode]),
  );
  return localized.episodes.map((episode) => {
    const fallback = englishByNumber.get(episode.episode_number);
    return {
      episodeNumber: episode.episode_number,
      title: firstFilled(episode.name, fallback?.name, `Episódio ${episode.episode_number}`),
      overview: firstFilled(episode.overview, fallback?.overview),
      runtimeMinutes: episode.runtime ?? fallback?.runtime ?? null,
      stillPath: firstFilled(episode.still_path, fallback?.still_path) || null,
    };
  });
}

export function seasonNeedsEnglishFallback(localized: TmdbSeasonDetails): boolean {
  return localized.episodes.some((episode) => filled(episode.name) === "" || filled(episode.overview) === "");
}
