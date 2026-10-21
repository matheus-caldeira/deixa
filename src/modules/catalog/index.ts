export * from "./domain/catalog";
export type {
  CatalogEntry,
  CatalogRepository,
  EpisodeMetadata,
  EpisodeProgressEntry,
  EpisodeProgressRepository,
  EpisodeUpsert,
  EpisodeWithSeason,
  MediaUpsert,
  MetadataProvider,
  SeasonSummary,
  SeasonUpsert,
  WorkCandidate,
  WorkDetails,
  WorkSummary,
} from "./application/ports";
export { makeRegisterWork, makeRefreshWork } from "./application/register-work";
export { makeLoadSeasonEpisodes } from "./application/load-season-episodes";
export { makeSearchWorks, type WorkSearchResult } from "./application/search-works";
export {
  makeGetCatalogOverview,
  makeGetEpisodeContext,
  makeGetMediaDetail,
  makeStartEpisode,
  type CatalogOverview,
  type InProgressEntry,
  type MediaDetail,
} from "./application/browse-catalog";
export {
  LEVEL_FETCH_FAILURES,
  makeAddLevelSource,
  makeGetWorkLevelRatings,
  makeListLevelSources,
  makeRecomputeCatalogLevels,
  makeRemoveLevelSource,
  makeResolveLevelRatings,
  makeSetLevelSourceEnabled,
  makeSyncLevelSources,
  type LevelFetchFailure,
  type LevelRating,
  type LevelSource,
  type WorkLevelRatings,
} from "./application/level-sources";
export {
  LEVEL_SOURCE_STATUSES,
  MAX_LEVEL_SOURCES,
  aggregateLevelRanges,
  type LevelRange,
  type LevelSourceStatus,
} from "./domain/level-ratings";
