export * from "./domain/series";
export type {
  DescribeSeriesInput,
  EpisodeSource,
  LearnerHints,
  OwnedEpisode,
  PersonalSeriesRepository,
} from "./application/ports";
export {
  makeGetEpisodeTrail,
  makeGetPersonalSeries,
  makeGetSeasonContext,
  makePlaceCards,
  makeRefreshSeriesDescription,
  makeRenameSeries,
  makeSetSeriesLevel,
  type EpisodeTrailView,
  type SeasonView,
  type SeriesDeps,
  type SeriesView,
} from "./application/series-use-cases";
export {
  makeBuildPersonalRecap,
  makeCompletePersonalLesson,
  makeStartPersonalLesson,
} from "./application/lesson-use-cases";
