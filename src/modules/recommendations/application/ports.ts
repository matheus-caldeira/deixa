import type { MediaType, MetadataProvider, MetadataProviderName } from "@/modules/catalog";
import type { CefrLevel } from "@/shared/levels";
import type { Challenge, LearnerSignals } from "../domain/learner";
import type { Vector } from "../domain/vectors";

export type EmbeddingProviderName = "gemini" | "local";
export type WriterName = "gemini" | "local";

export interface EmbeddingProvider {
  readonly name: EmbeddingProviderName;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export type WriterInput = {
  learner: {
    level: CefrLevel;
    challenge: Challenge;
    accuracyPercent: number | null;
    forgottenPercent: number | null;
    marksPerHundredLines: number | null;
    studied: string[];
    hardTerms: string[];
  };
  candidates: {
    key: string;
    title: string;
    type: MediaType;
    year: number | null;
    genres: string[];
    overview: string;
    closestStudied: string | null;
  }[];
  limit: number;
};

export interface SuggestionWriter {
  readonly name: "gemini";
  write(input: WriterInput): Promise<unknown>;
}

export type CandidateSource = Pick<MetadataProvider, "name" | "listRelatedWorks" | "listPopularWorks">;

export type Suggestion = {
  workKey: string;
  provider: MetadataProviderName;
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  year: number | null;
  posterPath: string | null;
  genres: string[];
  levelMin: CefrLevel;
  levelMax: CefrLevel;
  score: number;
  reason: string;
  position: number;
};

export type RunStatus = "RUNNING" | "READY" | "FAILED";

export type RecommendationRun = {
  status: RunStatus;
  fingerprint: string | null;
  writer: WriterName | null;
  embedding: EmbeddingProviderName | null;
  insight: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export type RunOutcome = {
  status: "READY" | "FAILED";
  fingerprint: string | null;
  writer: WriterName | null;
  embedding: EmbeddingProviderName | null;
  insight: string | null;
  failureReason: string | null;
};

export type FeedbackVerdict = "dismissed" | "added";
export type Feedback = { workKey: string; verdict: FeedbackVerdict };

export interface RecommendationRepository {
  loadSignals(userId: string, since: Date): Promise<Omit<LearnerSignals, "level">>;
  getRun(userId: string): Promise<RecommendationRun | null>;
  claimRun(userId: string, now: Date, stuckBefore: Date): Promise<boolean>;
  finishRun(userId: string, outcome: RunOutcome, now: Date): Promise<void>;
  listSuggestions(userId: string): Promise<Suggestion[]>;
  findSuggestion(userId: string, workKey: string): Promise<Suggestion | null>;
  replaceSuggestions(userId: string, suggestions: Suggestion[], now: Date): Promise<void>;
  removeSuggestion(userId: string, workKey: string): Promise<void>;
  saveFeedback(userId: string, workKey: string, verdict: FeedbackVerdict, now: Date): Promise<void>;
  listFeedback(userId: string): Promise<Feedback[]>;
  getEmbeddings(model: string, workKeys: string[]): Promise<Map<string, Vector>>;
  saveEmbeddings(model: string, entries: { workKey: string; vector: Vector }[], now: Date): Promise<void>;
}
