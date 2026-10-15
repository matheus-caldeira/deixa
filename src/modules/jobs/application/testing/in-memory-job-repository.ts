import type { Job, JobKind } from "../../domain/job";
import type { JobCounts, JobRepository, NewJob } from "../ports";

export class InMemoryJobRepository implements JobRepository {
  readonly jobs = new Map<string, Job>();

  async enqueue(job: NewJob): Promise<void> {
    this.jobs.set(job.id, {
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

  private claimable(job: Job, now: Date): boolean {
    if (job.status === "QUEUED") return job.runAfter.getTime() <= now.getTime();
    if (job.status === "RUNNING")
      return job.lockedUntil !== null && job.lockedUntil.getTime() < now.getTime();
    return false;
  }

  private lock(job: Job, now: Date, lockMs: number): Job {
    const claimed: Job = {
      ...job,
      status: "RUNNING",
      attempts: job.attempts + 1,
      lockedUntil: new Date(now.getTime() + lockMs),
      updatedAt: now,
    };
    this.jobs.set(job.id, claimed);
    return claimed;
  }

  async claimNext(now: Date, lockMs: number): Promise<Job | null> {
    const next = [...this.jobs.values()]
      .filter((job) => this.claimable(job, now))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return next ? this.lock(next, now, lockMs) : null;
  }

  async claimById(id: string, now: Date, lockMs: number): Promise<Job | null> {
    const job = this.jobs.get(id);
    return job && this.claimable(job, now) ? this.lock(job, now, lockMs) : null;
  }

  async complete(id: string, now: Date): Promise<void> {
    const job = this.jobs.get(id);
    if (job) this.jobs.set(id, { ...job, status: "DONE", lockedUntil: null, updatedAt: now });
  }

  async release(id: string, input: { runAfter: Date; reason: string }, now: Date): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, {
        ...job,
        status: "QUEUED",
        runAfter: input.runAfter,
        lockedUntil: null,
        failureReason: input.reason,
        updatedAt: now,
      });
    }
  }

  async fail(id: string, reason: string, now: Date): Promise<void> {
    const job = this.jobs.get(id);
    if (job)
      this.jobs.set(id, {
        ...job,
        status: "FAILED",
        lockedUntil: null,
        failureReason: reason,
        updatedAt: now,
      });
  }

  async find(id: string): Promise<Job | null> {
    return this.jobs.get(id) ?? null;
  }

  async countPending(kind: JobKind, payloadMatch: Record<string, string>): Promise<JobCounts> {
    const matching = [...this.jobs.values()].filter((job) => {
      if (job.kind !== kind) return false;
      const payload = job.payload as Record<string, unknown>;
      return Object.entries(payloadMatch).every(([key, value]) => payload[key] === value);
    });
    return {
      queued: matching.filter((job) => job.status === "QUEUED").length,
      running: matching.filter((job) => job.status === "RUNNING").length,
    };
  }
}
