export type AppErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "MEDIA_NOT_FOUND"
  | "SEASON_NOT_FOUND"
  | "EPISODE_NOT_FOUND"
  | "EPISODE_NOT_READY"
  | "CUE_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "CARD_NOT_FOUND"
  | "BATCH_NOT_FOUND"
  | "NO_HIGHLIGHTS"
  | "SUBTITLE_INVALID"
  | "SUBTITLE_VERSION_CONFLICT"
  | "METADATA_UNAVAILABLE"
  | "METADATA_UNAUTHORIZED"
  | "METADATA_NOT_FOUND"
  | "LLM_FAILED"
  | "LLM_INVALID_OUTPUT"
  | "AI_KEY_INVALID"
  | "AI_KEY_REJECTED"
  | "AI_LIMIT_REACHED"
  | "SUBTITLE_SOURCE_QUOTA"
  | "SUBTITLE_SOURCE_UNAVAILABLE"
  | "SUBTITLE_SOURCE_EMPTY"
  | "AUDIO_BUSY"
  | "AUDIO_UNAVAILABLE";

export type MessageParams = Record<string, string | number>;

export type AppErrorDetail = { key: string; params?: MessageParams };

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail: AppErrorDetail | null;

  constructor(code: AppErrorCode, detail?: string | AppErrorDetail) {
    const normalized = typeof detail === "string" ? { key: detail } : (detail ?? null);
    super(normalized ? `${code}:${normalized.key}` : code);
    this.name = "AppError";
    this.code = code;
    this.detail = normalized;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
