import { and, asc, eq, lt, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { jobQueue } from "@/infrastructure/database/schema";
import { isJobKind, isJobStatus, type Job, type JobKind } from "../domain/job";
import type { JobCounts, JobRepository, NewJob } from "../application/ports";

type Row = typeof jobQueue.$inferSelect;

function toJob(row: Row): Job | null {
  if (!isJobKind(row.kind) || !isJobStatus(row.status)) return null;
  return {
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAfter: row.runAfter,
    lockedUntil: row.lockedUntil,
    failureReason: row.failureReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const claimable = (now: Date) =>
  or(
    and(eq(jobQueue.status, "QUEUED"), lte(jobQueue.runAfter, now)),
    and(eq(jobQueue.status, "RUNNING"), lt(jobQueue.lockedUntil, now)),
  );

export class DrizzleJobRepository implements JobRepository {
  constructor(private readonly db: Database) {}

  async enqueue(job: NewJob): Promise<void> {
    await this.db.insert(jobQueue).values({
      id: job.id,
      kind: job.kind,
      payload: job.payload,
      status: "QUEUED",
      attempts: 0,
      maxAttempts: job.maxAttempts,
      runAfter: job.runAfter,
      lockedUntil: null,
      failureReason: null,
      createdBy: job.createdBy,
      createdAt: job.now,
      updatedAt: job.now,
    });
  }

  private async claimWhere(
    condition: ReturnType<typeof claimable>,
    now: Date,
    lockMs: number,
  ): Promise<Job | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(jobQueue)
        .where(condition)
        .orderBy(asc(jobQueue.createdAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      const [updated] = await tx
        .update(jobQueue)
        .set({
          status: "RUNNING",
          attempts: row.attempts + 1,
          lockedUntil: new Date(now.getTime() + lockMs),
          updatedAt: now,
        })
        .where(eq(jobQueue.id, row.id))
        .returning();
      return updated ? toJob(updated) : null;
    });
  }

  async claimNext(now: Date, lockMs: number): Promise<Job | null> {
    return this.claimWhere(claimable(now), now, lockMs);
  }

  async claimById(id: string, now: Date, lockMs: number): Promise<Job | null> {
    return this.claimWhere(and(eq(jobQueue.id, id), claimable(now)), now, lockMs);
  }

  async complete(id: string, now: Date): Promise<void> {
    await this.db
      .update(jobQueue)
      .set({ status: "DONE", lockedUntil: null, updatedAt: now })
      .where(eq(jobQueue.id, id));
  }

  async release(id: string, input: { runAfter: Date; reason: string }, now: Date): Promise<void> {
    await this.db
      .update(jobQueue)
      .set({
        status: "QUEUED",
        runAfter: input.runAfter,
        lockedUntil: null,
        failureReason: input.reason,
        updatedAt: now,
      })
      .where(eq(jobQueue.id, id));
  }

  async fail(id: string, reason: string, now: Date): Promise<void> {
    await this.db
      .update(jobQueue)
      .set({ status: "FAILED", lockedUntil: null, failureReason: reason, updatedAt: now })
      .where(eq(jobQueue.id, id));
  }

  async find(id: string): Promise<Job | null> {
    const [row] = await this.db.select().from(jobQueue).where(eq(jobQueue.id, id)).limit(1);
    return row ? toJob(row) : null;
  }

  async countPending(kind: JobKind, payloadMatch: Record<string, string>): Promise<JobCounts> {
    const rows = await this.db
      .select({ status: jobQueue.status, total: sql<number>`count(*)::int` })
      .from(jobQueue)
      .where(
        and(
          eq(jobQueue.kind, kind),
          or(eq(jobQueue.status, "QUEUED"), eq(jobQueue.status, "RUNNING")),
          sql`${jobQueue.payload} @> ${JSON.stringify(payloadMatch)}::jsonb`,
        ),
      )
      .groupBy(jobQueue.status);
    const count = (status: string) => rows.find((row) => row.status === status)?.total ?? 0;
    return { queued: count("QUEUED"), running: count("RUNNING") };
  }
}
