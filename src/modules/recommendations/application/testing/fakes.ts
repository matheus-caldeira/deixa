import type { LearnerSignals } from "../../domain/learner";
import type { Vector } from "../../domain/vectors";
import type {
  EmbeddingProvider,
  Feedback,
  FeedbackVerdict,
  RecommendationRepository,
  RecommendationRun,
  RunOutcome,
  Suggestion,
} from "../ports";

export type StoredSignals = Omit<LearnerSignals, "level" | "language">;

export const EMPTY_SIGNALS: StoredSignals = {
  works: [],
  lessons: { answers: 0, correct: 0, attempts: 0, failed: 0 },
  reviews: { total: 0, again: 0 },
  reading: { marks: 0, cuesRead: 0 },
  hardTerms: [],
};

export class InMemoryRecommendationRepository implements RecommendationRepository {
  readonly signals = new Map<string, StoredSignals>();
  readonly runs = new Map<string, RecommendationRun>();
  readonly suggestions = new Map<string, Suggestion[]>();
  readonly feedback = new Map<string, Feedback[]>();
  readonly embeddings = new Map<string, Vector>();

  async loadSignals(userId: string): Promise<StoredSignals> {
    return this.signals.get(userId) ?? EMPTY_SIGNALS;
  }

  async getRun(userId: string): Promise<RecommendationRun | null> {
    return this.runs.get(userId) ?? null;
  }

  async claimRun(userId: string, now: Date, stuckBefore: Date): Promise<boolean> {
    const known = this.runs.get(userId);
    if (known?.status === "RUNNING" && known.startedAt >= stuckBefore) return false;
    this.runs.set(userId, {
      status: "RUNNING",
      fingerprint: known?.fingerprint ?? null,
      writer: known?.writer ?? null,
      embedding: known?.embedding ?? null,
      insight: known?.insight ?? null,
      startedAt: now,
      finishedAt: known?.finishedAt ?? null,
    });
    return true;
  }

  async finishRun(userId: string, outcome: RunOutcome, now: Date): Promise<void> {
    const known = this.runs.get(userId);
    if (!known) return;
    this.runs.set(userId, {
      status: outcome.status,
      fingerprint: outcome.fingerprint,
      writer: outcome.writer,
      embedding: outcome.embedding,
      insight: outcome.insight,
      startedAt: known.startedAt,
      finishedAt: now,
    });
  }

  async listSuggestions(userId: string): Promise<Suggestion[]> {
    return [...(this.suggestions.get(userId) ?? [])];
  }

  async findSuggestion(userId: string, workKey: string): Promise<Suggestion | null> {
    return (this.suggestions.get(userId) ?? []).find((item) => item.workKey === workKey) ?? null;
  }

  async replaceSuggestions(userId: string, suggestions: Suggestion[]): Promise<void> {
    this.suggestions.set(userId, suggestions);
  }

  async removeSuggestion(userId: string, workKey: string): Promise<void> {
    this.suggestions.set(
      userId,
      (this.suggestions.get(userId) ?? []).filter((item) => item.workKey !== workKey),
    );
  }

  async saveFeedback(userId: string, workKey: string, verdict: FeedbackVerdict): Promise<void> {
    const others = (this.feedback.get(userId) ?? []).filter((entry) => entry.workKey !== workKey);
    this.feedback.set(userId, [...others, { workKey, verdict }]);
  }

  async listFeedback(userId: string): Promise<Feedback[]> {
    return [...(this.feedback.get(userId) ?? [])];
  }

  async getEmbeddings(model: string, workKeys: string[]): Promise<Map<string, Vector>> {
    const known = new Map<string, Vector>();
    for (const workKey of workKeys) {
      const vector = this.embeddings.get(`${model}|${workKey}`);
      if (vector) known.set(workKey, vector);
    }
    return known;
  }

  async saveEmbeddings(model: string, entries: { workKey: string; vector: Vector }[]): Promise<void> {
    for (const entry of entries) this.embeddings.set(`${model}|${entry.workKey}`, entry.vector);
  }
}

export class CountingEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini" as const;
  readonly model = "contador-v1";
  embedded: string[] = [];
  failing = false;

  constructor(private readonly inner: EmbeddingProvider) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (this.failing) throw new Error("serviço de vetores fora do ar");
    this.embedded.push(...texts);
    return this.inner.embed(texts);
  }
}
