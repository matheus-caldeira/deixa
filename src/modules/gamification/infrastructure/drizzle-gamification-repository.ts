import type { StudyLanguage } from "@/shared/study-languages";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import {
  conversationSessions,
  episodeProgress,
  learningItems,
  lessonAttempts,
  reviewLogs,
  userCards,
  xpEvents,
} from "@/infrastructure/database/schema";
import type { DailyXp } from "../domain/activity";
import type { KindStats } from "../domain/profile";
import type { ActivityCounts, LessonStats, XpRepository } from "../application/ports";

const total = sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`;
const COMPLETE = 100;
const AGAIN = "again";
const PHRASAL = "phrasal_verb";
const kindsSchema = z.record(z.string(), z.object({ correct: z.number(), total: z.number() }));
const reviewScoreSchema = z.object({ score: z.number() });

export class DrizzleGamificationRepository implements XpRepository, ActivityCounts {
  constructor(private readonly db: Database) {}

  async award(event: {
    id: string;
    userId: string;
    source: string;
    sourceId: string;
    amount: number;
    createdAt: Date;
  }): Promise<boolean> {
    const inserted = await this.db
      .insert(xpEvents)
      .values(event)
      .onConflictDoNothing({ target: [xpEvents.userId, xpEvents.source, xpEvents.sourceId] })
      .returning({ id: xpEvents.id });
    return inserted.length > 0;
  }

  async dailyTotals(userId: string, timeZone: string): Promise<DailyXp[]> {
    const day = sql<string>`to_char(${xpEvents.createdAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;
    const rows = await this.db
      .select({ day, xp: total })
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId))
      .groupBy(sql`1`);
    return rows;
  }

  async reviewsSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviewLogs)
      .innerJoin(userCards, eq(userCards.id, reviewLogs.userCardId))
      .where(and(eq(userCards.userId, userId), gte(reviewLogs.reviewedAt, since)));
    return row?.total ?? 0;
  }

  async lessonsSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(lessonAttempts)
      .where(and(eq(lessonAttempts.userId, userId), gte(lessonAttempts.createdAt, since)));
    return row?.total ?? 0;
  }

  async lessonsEver(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(lessonAttempts)
      .where(eq(lessonAttempts.userId, userId));
    return row?.total ?? 0;
  }

  async cardsOwned(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(userCards)
      .where(eq(userCards.userId, userId));
    return row?.total ?? 0;
  }

  async lessonStats(userId: string, since: Date | null): Promise<LessonStats> {
    const rows = await this.db
      .select({
        correct: lessonAttempts.correct,
        total: lessonAttempts.total,
        passed: lessonAttempts.passed,
        kinds: lessonAttempts.kinds,
      })
      .from(lessonAttempts)
      .where(
        since
          ? and(eq(lessonAttempts.userId, userId), gte(lessonAttempts.createdAt, since))
          : eq(lessonAttempts.userId, userId),
      );
    const byKind: KindStats = {};
    const stats: LessonStats = { correct: 0, total: 0, passed: 0, byKind };
    for (const row of rows) {
      stats.correct += row.correct;
      stats.total += row.total;
      if (row.passed) stats.passed += 1;
      const kinds = kindsSchema.safeParse(row.kinds);
      if (!kinds.success) continue;
      for (const [kind, counts] of Object.entries(kinds.data)) {
        const known = byKind[kind] ?? { correct: 0, total: 0 };
        byKind[kind] = { correct: known.correct + counts.correct, total: known.total + counts.total };
      }
    }
    return stats;
  }

  async reviewOutcomesSince(userId: string, since: Date): Promise<{ total: number; again: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        again: sql<number>`count(*) filter (where ${reviewLogs.rating} = ${AGAIN})::int`,
      })
      .from(reviewLogs)
      .innerJoin(userCards, eq(userCards.id, reviewLogs.userCardId))
      .where(and(eq(userCards.userId, userId), gte(reviewLogs.reviewedAt, since)));
    return { total: row?.total ?? 0, again: row?.again ?? 0 };
  }

  async recurringMisses(
    userId: string,
    since: Date,
    limit: number,
    language?: StudyLanguage,
  ): Promise<{ term: string; count: number }[]> {
    const count = sql<number>`count(*)::int`;
    const rows = await this.db
      .select({ term: learningItems.sourceText, count })
      .from(reviewLogs)
      .innerJoin(userCards, eq(userCards.id, reviewLogs.userCardId))
      .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
      .where(
        and(
          eq(userCards.userId, userId),
          eq(reviewLogs.rating, AGAIN),
          gte(reviewLogs.reviewedAt, since),
          language ? eq(learningItems.language, language) : undefined,
        ),
      )
      .groupBy(learningItems.sourceText)
      .orderBy(desc(count), learningItems.sourceText)
      .limit(limit);
    return rows;
  }

  async episodesCompleted(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(episodeProgress)
      .where(and(eq(episodeProgress.userId, userId), gte(episodeProgress.progressPercent, COMPLETE)));
    return row?.total ?? 0;
  }

  async conversationScores(userId: string): Promise<number[]> {
    const rows = await this.db
      .select({ review: conversationSessions.review })
      .from(conversationSessions)
      .where(and(eq(conversationSessions.userId, userId), isNotNull(conversationSessions.review)));
    return rows.flatMap((row) => {
      const parsed = reviewScoreSchema.safeParse(row.review);
      return parsed.success ? [parsed.data.score] : [];
    });
  }

  async phrasalCards(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(userCards)
      .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
      .where(and(eq(userCards.userId, userId), eq(learningItems.itemType, PHRASAL)));
    return row?.total ?? 0;
  }
}
