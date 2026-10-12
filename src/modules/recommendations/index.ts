export type {
  CandidateSource,
  EmbeddingProvider,
  EmbeddingProviderName,
  Feedback,
  FeedbackVerdict,
  RecommendationRepository,
  RecommendationRun,
  RunOutcome,
  Suggestion,
  SuggestionWriter,
  WriterInput,
  WriterName,
} from "./application/ports";
export {
  makeAcceptRecommendation,
  makeDismissRecommendation,
  makeGetRecommendations,
  makeRefreshRecommendations,
  type RecommendationsView,
} from "./application/recommendation-use-cases";
export { fitLabel, type LearnerSignals, type StudiedWork } from "./domain/learner";
export type { Vector } from "./domain/vectors";
