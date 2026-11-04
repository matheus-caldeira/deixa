export const JOB_KINDS = [
  "generate_plan",
  "card_batch",
  "refresh_recommendations",
  "episode_audio",
  "conversation_review",
  "conversation_terms",
  "conversation_audio",
  "personal_series_description",
  "level_sources_sync",
  "episode_level",
] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = ["QUEUED", "RUNNING", "DONE", "FAILED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: string;
  kind: JobKind;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  lockedUntil: Date | null;
  failureReason: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const MAX_ATTEMPTS_BY_KIND: Record<JobKind, number> = {
  generate_plan: 1,
  card_batch: 1,
  refresh_recommendations: 1,
  episode_audio: 3,
  conversation_review: 1,
  conversation_terms: 1,
  conversation_audio: 3,
  personal_series_description: 1,
  level_sources_sync: 2,
  episode_level: 1,
};

export const JOB_LOCK_MS = 15 * 60 * 1000;
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;

export function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
}

export function isJobKind(value: string): value is JobKind {
  return (JOB_KINDS as readonly string[]).includes(value);
}

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}
