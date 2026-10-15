import { isAppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { backoffMs, JOB_LOCK_MS, MAX_ATTEMPTS_BY_KIND, type Job, type JobKind } from "../domain/job";
import { PAYLOAD_SCHEMAS, type JobPayloads } from "../domain/payloads";
import type { JobRepository } from "./ports";

export type JobHandlers = { [K in JobKind]: (payload: JobPayloads[K]) => Promise<void> };

export type JobOutcome =
  | { outcome: "done"; job: Job }
  | { outcome: "retry"; job: Job; runAfter: Date; reason: string }
  | { outcome: "failed"; job: Job; reason: string };

const INVALID_PAYLOAD = "INVALID_PAYLOAD";
const UNKNOWN_FAILURE = "JOB_FAILED";
const MAX_REASON_LENGTH = 300;

function reasonOf(error: unknown): string {
  if (isAppError(error)) return error.code;
  if (error instanceof Error && error.message) return error.message.slice(0, MAX_REASON_LENGTH);
  return UNKNOWN_FAILURE;
}

export function makeEnqueueJob(deps: { jobs: JobRepository; clock: Clock; ids: IdGenerator }) {
  return async function enqueueJob<K extends JobKind>(input: {
    kind: K;
    payload: JobPayloads[K];
    createdBy?: string;
  }): Promise<{ jobId: string }> {
    const now = deps.clock.now();
    const jobId = deps.ids.next();
    await deps.jobs.enqueue({
      id: jobId,
      kind: input.kind,
      payload: input.payload,
      maxAttempts: MAX_ATTEMPTS_BY_KIND[input.kind],
      runAfter: now,
      createdBy: input.createdBy ?? null,
      now,
    });
    return { jobId };
  };
}

export function makeRunClaimedJob(deps: {
  jobs: JobRepository;
  handlers: JobHandlers;
  clock: Clock;
  lockMs?: number;
}) {
  async function execute(job: Job): Promise<void> {
    const parsed = PAYLOAD_SCHEMAS[job.kind].safeParse(job.payload);
    if (!parsed.success) throw new Error(INVALID_PAYLOAD);
    const handler = deps.handlers[job.kind] as (payload: unknown) => Promise<void>;
    await handler(parsed.data);
  }

  return async function runClaimedJob(job: Job): Promise<JobOutcome> {
    try {
      await execute(job);
      await deps.jobs.complete(job.id, deps.clock.now());
      return { outcome: "done", job };
    } catch (error) {
      const reason = reasonOf(error);
      const now = deps.clock.now();
      if (reason !== INVALID_PAYLOAD && job.attempts < job.maxAttempts) {
        const runAfter = new Date(now.getTime() + backoffMs(job.attempts));
        await deps.jobs.release(job.id, { runAfter, reason }, now);
        return { outcome: "retry", job, runAfter, reason };
      }
      await deps.jobs.fail(job.id, reason, now);
      return { outcome: "failed", job, reason };
    }
  };
}

export function makeRunJobInline(deps: {
  jobs: JobRepository;
  run: (job: Job) => Promise<JobOutcome>;
  clock: Clock;
  lockMs?: number;
}) {
  const lockMs = deps.lockMs ?? JOB_LOCK_MS;
  return async function runJobInline(jobId: string): Promise<JobOutcome | null> {
    let last: JobOutcome | null = null;
    for (;;) {
      const claimed = await deps.jobs.claimById(jobId, deps.clock.now(), lockMs);
      if (!claimed) return last;
      last = await deps.run(claimed);
      if (last.outcome !== "retry") return last;
      await deps.jobs.release(jobId, { runAfter: deps.clock.now(), reason: last.reason }, deps.clock.now());
    }
  };
}

export function makeRunNextJob(deps: {
  jobs: JobRepository;
  run: (job: Job) => Promise<JobOutcome>;
  clock: Clock;
  lockMs?: number;
}) {
  const lockMs = deps.lockMs ?? JOB_LOCK_MS;
  return async function runNextJob(): Promise<JobOutcome | null> {
    const claimed = await deps.jobs.claimNext(deps.clock.now(), lockMs);
    if (!claimed) return null;
    return deps.run(claimed);
  };
}

export function makeHasPendingJob(deps: { jobs: JobRepository }) {
  return async function hasPendingJob(kind: JobKind, payloadMatch: Record<string, string>): Promise<boolean> {
    const counts = await deps.jobs.countPending(kind, payloadMatch);
    return counts.queued + counts.running > 0;
  };
}
