import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { progressSnapshots, xpEvents } from "@/infrastructure/database/schema";
import { profileSnapshotSchema, type ProfileSnapshot } from "../domain/profile";
import type { SnapshotRepository, XpRepository } from "../application/ports";

const total = sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`;

export class DrizzleGamificationRepository implements XpRepository, SnapshotRepository {
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

  async sumSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since)));
    return row?.total ?? 0;
  }

  async total(userId: string): Promise<number> {
    const [row] = await this.db.select({ total }).from(xpEvents).where(eq(xpEvents.userId, userId));
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
