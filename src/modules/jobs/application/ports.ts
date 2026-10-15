import type { Job, JobKind } from "../domain/job";

export type NewJob = {
  id: string;
  kind: JobKind;
  payload: unknown;
  maxAttempts: number;
  runAfter: Date;
  createdBy: string | null;
  now: Date;
};

export type JobCounts = { queued: number; running: number };

export interface JobRepository {
  enqueue(job: NewJob): Promise<void>;
  claimNext(now: Date, lockMs: number): Promise<Job | null>;
  claimById(id: string, now: Date, lockMs: number): Promise<Job | null>;
  complete(id: string, now: Date): Promise<void>;
  release(id: string, input: { runAfter: Date; reason: string }, now: Date): Promise<void>;
  fail(id: string, reason: string, now: Date): Promise<void>;
  find(id: string): Promise<Job | null>;
  countPending(kind: JobKind, payloadMatch: Record<string, string>): Promise<JobCounts>;
}
