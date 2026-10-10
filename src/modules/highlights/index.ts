export * from "./domain/highlights";
export type { HighlightRepository, LoadScript, ReadableLine, ReadableScript } from "./application/ports";
export {
  makeGetReadingView,
  makeListPendingHighlights,
  makeMarkHighlightsCarded,
  makeSyncHighlights,
  type ReadingLine,
  type ReadingView,
} from "./application/highlight-use-cases";
