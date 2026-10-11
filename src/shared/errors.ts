export type AppErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
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
  | "SUBTITLE_SOURCE_QUOTA"
  | "SUBTITLE_SOURCE_UNAVAILABLE"
  | "SUBTITLE_SOURCE_EMPTY"
  | "AUDIO_BUSY"
  | "AUDIO_UNAVAILABLE";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
