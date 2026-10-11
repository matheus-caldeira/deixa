import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import {
  lessonAttempts,
  progressSnapshots,
  reviewLogs,
  userCards,
  xpEvents,
} from "@/infrastructure/database/schema";
import type { DailyXp } from "../domain/activity";
import { profileSnapshotSchema, type ProfileSnapshot } from "../domain/profile";
import type { ActivityCounts, SnapshotRepository, XpRepository } from "../application/ports";

const total = sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`;

export class DrizzleGamificationRepository implements XpRepository, SnapshotRepository, ActivityCounts {
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

  async get(userId: string): Promise<ProfileSnapshot | null> {
    const [row] = await this.db
      .select({ data: progressSnapshots.data })
      .from(progressSnapshots)
      .where(eq(progressSnapshots.userId, userId))
      .limit(1);
    const parsed = row ? profileSnapshotSchema.safeParse(row.data) : null;
    return parsed?.success ? parsed.data : null;
  }

  async upsert(userId: string, snapshot: ProfileSnapshot, now: Date): Promise<void> {
    await this.db
      .insert(progressSnapshots)
      .values({ userId, data: snapshot, updatedAt: now })
      .onConflictDoUpdate({ target: progressSnapshots.userId, set: { data: snapshot, updatedAt: now } });
  }
}
