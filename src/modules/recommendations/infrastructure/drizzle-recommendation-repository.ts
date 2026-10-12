import { and, asc, desc, eq, gt, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import {
  episodeProgress,
  episodes,
  learningItems,
  lessonAttempts,
  mediaItems,
  recommendationFeedback,
  recommendationRuns,
  reviewLogs,
  seasons,
  userCards,
  userHighlights,
  userRecommendations,
  workEmbeddings,
} from "@/infrastructure/database/schema";
import { CEFR_LEVELS } from "@/shared/levels";
import type { LearnerSignals } from "../domain/learner";
import type { Vector } from "../domain/vectors";
import type {
  Feedback,
  FeedbackVerdict,
  RecommendationRepository,
  RecommendationRun,
  RunOutcome,
  Suggestion,
} from "../application/ports";

const PERCENT = 100;
const STARTED_WEIGHT = 0.5;
const MAX_HARD_TERMS = 12;
const MAX_TERM_CHARS = 40;
const AGAIN = "again";

const vectorSchema = z.array(z.number());
const suggestionSchema = z.object({
  workKey: z.string(),
  provider: z.enum(["tmdb", "fake"]),
  externalId: z.string(),
  type: z.enum(["series", "movie"]),
  title: z.string(),
  originalTitle: z.string(),
  overview: z.string(),
  year: z.number().nullable(),
  posterPath: z.string().nullable(),
  genres: z.array(z.string()),
  levelMin: z.enum(CEFR_LEVELS),
  levelMax: z.enum(CEFR_LEVELS),
  score: z.number(),
  reason: z.string(),
  position: z.number(),
});
const runSchema = z.object({
  status: z.enum(["RUNNING", "READY", "FAILED"]),
  fingerprint: z.string().nullable(),
  writer: z.enum(["gemini", "local"]).nullable(),
  embedding: z.enum(["gemini", "local"]).nullable(),
  insight: z.string().nullable(),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
});
const verdictSchema = z.enum(["dismissed", "added"]);

const integer = (expression: ReturnType<typeof sql>) => sql<number>`coalesce(${expression}, 0)::int`;

export class DrizzleRecommendationRepository implements RecommendationRepository {
  constructor(private readonly db: Database) {}

  async loadSignals(userId: string, since: Date): Promise<Omit<LearnerSignals, "level">> {
    const [works, lessonRows, reviewRows, markedEpisodes, terms] = await Promise.all([
      this.db
        .select({
          provider: mediaItems.metadataProvider,
          externalId: mediaItems.externalId,
          type: mediaItems.type,
          title: mediaItems.title,
          overview: mediaItems.overview,
          progress: integer(sql`sum(${episodeProgress.progressPercent})`),
        })
        .from(episodeProgress)
        .innerJoin(episodes, eq(episodes.id, episodeProgress.episodeId))
        .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
        .innerJoin(mediaItems, eq(mediaItems.id, seasons.mediaItemId))
        .where(eq(episodeProgress.userId, userId))
        .groupBy(mediaItems.id),
      this.db
        .select({
          answers: integer(sql`sum(${lessonAttempts.total})`),
          correct: integer(sql`sum(${lessonAttempts.correct})`),
          attempts: integer(sql`count(*)`),
          failed: integer(sql`count(*) filter (where not ${lessonAttempts.passed})`),
        })
        .from(lessonAttempts)
        .where(and(eq(lessonAttempts.userId, userId), gte(lessonAttempts.createdAt, since))),
      this.db
        .select({
          total: integer(sql`count(*)`),
          again: integer(sql`count(*) filter (where ${reviewLogs.rating} = ${AGAIN})`),
        })
        .from(reviewLogs)
        .innerJoin(userCards, eq(userCards.id, reviewLogs.userCardId))
        .where(and(eq(userCards.userId, userId), gte(reviewLogs.reviewedAt, since))),
      this.db
        .select({ marks: integer(sql`count(*)`), cues: integer(sql`max(${episodes.cueCount})`) })
        .from(userHighlights)
        .innerJoin(episodes, eq(episodes.id, userHighlights.episodeId))
        .where(and(eq(userHighlights.userId, userId), gte(userHighlights.createdAt, since)))
        .groupBy(userHighlights.episodeId),
      this.db
        .select({ term: learningItems.sourceText })
        .from(userCards)
        .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
        .where(and(eq(userCards.userId, userId), gt(userCards.lapses, 0)))
        .orderBy(desc(userCards.lapses), asc(userCards.createdAt))
        .limit(MAX_HARD_TERMS * 2),
    ]);
    const lessons = lessonRows[0] ?? { answers: 0, correct: 0, attempts: 0, failed: 0 };
    const reviews = reviewRows[0] ?? { total: 0, again: 0 };
    return {
      works: works.flatMap((work) =>
        work.type === "series" || work.type === "movie"
          ? [
              {
                workKey: `${work.provider}:${work.externalId}`,
                provider: work.provider,
                externalId: work.externalId,
                type: work.type,
                title: work.title,
                overview: work.overview,
                engagement: STARTED_WEIGHT + work.progress / PERCENT,
              },
            ]
          : [],
      ),
      lessons,
      reviews,
      reading: {
        marks: markedEpisodes.reduce((sum, row) => sum + row.marks, 0),
        cuesRead: markedEpisodes.reduce((sum, row) => sum + row.cues, 0),
      },
      hardTerms: terms
        .map((row) => row.term)
        .filter((term) => term.length <= MAX_TERM_CHARS)
        .slice(0, MAX_HARD_TERMS),
    };
  }

  async getRun(userId: string): Promise<RecommendationRun | null> {
    const [row] = await this.db
      .select()
      .from(recommendationRuns)
      .where(eq(recommendationRuns.userId, userId));
    const parsed = row ? runSchema.safeParse(row) : null;
    return parsed?.success ? parsed.data : null;
  }

  async claimRun(userId: string, now: Date, stuckBefore: Date): Promise<boolean> {
    const running = { status: "RUNNING", startedAt: now, finishedAt: null, failureReason: null };
    const claimed = await this.db
      .insert(recommendationRuns)
      .values({ userId, ...running })
      .onConflictDoUpdate({
        target: recommendationRuns.userId,
        set: { status: running.status, startedAt: now, failureReason: null },
        setWhere: or(ne(recommendationRuns.status, "RUNNING"), lt(recommendationRuns.startedAt, stuckBefore)),
      })
      .returning({ userId: recommendationRuns.userId });
    return claimed.length > 0;
  }

  async finishRun(userId: string, outcome: RunOutcome, now: Date): Promise<void> {
    await this.db
      .update(recommendationRuns)
      .set({ ...outcome, finishedAt: now })
      .where(eq(recommendationRuns.userId, userId));
  }

  async listSuggestions(userId: string): Promise<Suggestion[]> {
    const rows = await this.db
      .select()
      .from(userRecommendations)
      .where(eq(userRecommendations.userId, userId))
      .orderBy(asc(userRecommendations.position));
    return rows.flatMap((row) => {
      const parsed = suggestionSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async findSuggestion(userId: string, workKey: string): Promise<Suggestion | null> {
    const [row] = await this.db
      .select()
      .from(userRecommendations)
      .where(and(eq(userRecommendations.userId, userId), eq(userRecommendations.workKey, workKey)));
    const parsed = row ? suggestionSchema.safeParse(row) : null;
    return parsed?.success ? parsed.data : null;
  }

  async replaceSuggestions(userId: string, suggestions: Suggestion[], now: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.delete(userRecommendations).where(eq(userRecommendations.userId, userId));
      if (suggestions.length === 0) return;
      await transaction
        .insert(userRecommendations)
        .values(suggestions.map((suggestion) => ({ userId, ...suggestion, createdAt: now })));
    });
  }

  async removeSuggestion(userId: string, workKey: string): Promise<void> {
    await this.db
      .delete(userRecommendations)
      .where(and(eq(userRecommendations.userId, userId), eq(userRecommendations.workKey, workKey)));
  }

  async saveFeedback(userId: string, workKey: string, verdict: FeedbackVerdict, now: Date): Promise<void> {
    await this.db
      .insert(recommendationFeedback)
      .values({ userId, workKey, verdict, createdAt: now })
      .onConflictDoUpdate({
        target: [recommendationFeedback.userId, recommendationFeedback.workKey],
        set: { verdict, createdAt: now },
      });
  }

  async listFeedback(userId: string): Promise<Feedback[]> {
    const rows = await this.db
      .select({ workKey: recommendationFeedback.workKey, verdict: recommendationFeedback.verdict })
      .from(recommendationFeedback)
      .where(eq(recommendationFeedback.userId, userId));
    return rows.flatMap((row) => {
      const verdict = verdictSchema.safeParse(row.verdict);
      return verdict.success ? [{ workKey: row.workKey, verdict: verdict.data }] : [];
    });
  }

  async getEmbeddings(model: string, workKeys: string[]): Promise<Map<string, Vector>> {
    const known = new Map<string, Vector>();
    if (workKeys.length === 0) return known;
    const rows = await this.db
      .select({ workKey: workEmbeddings.workKey, vector: workEmbeddings.vector })
      .from(workEmbeddings)
      .where(and(eq(workEmbeddings.model, model), inArray(workEmbeddings.workKey, workKeys)));
    for (const row of rows) {
      const parsed = vectorSchema.safeParse(row.vector);
      if (parsed.success) known.set(row.workKey, parsed.data);
    }
    return known;
  }

  async saveEmbeddings(
    model: string,
    entries: { workKey: string; vector: Vector }[],
    now: Date,
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.db
      .insert(workEmbeddings)
      .values(
        entries.map((entry) => ({
          workKey: entry.workKey,
          model,
          vector: [...entry.vector],
          createdAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [workEmbeddings.workKey, workEmbeddings.model],
        set: { vector: sql`excluded.vector`, createdAt: now },
      });
  }
}
