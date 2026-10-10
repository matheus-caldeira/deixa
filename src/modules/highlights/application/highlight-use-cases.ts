import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { tokenize } from "@/shared/text";
import {
  spanKey,
  spansFromMarks,
  visibleMarkCounts,
  type CueMarks,
  type Highlight,
  type ShareScope,
} from "../domain/highlights";
import type { HighlightRepository, LoadScript, ReadableLine } from "./ports";

type Deps = { highlights: HighlightRepository; loadScript: LoadScript; clock: Clock; ids: IdGenerator };

export type ReadingLine = ReadableLine & { tokens: string[]; markedByCount: number | null };
export type ReadingView = {
  episodeId: string;
  hasPortuguese: boolean;
  lines: ReadingLine[];
  highlights: Highlight[];
};

export function makeSyncHighlights(deps: Deps) {
  return async function syncHighlights(input: {
    userId: string;
    episodeId: string;
    marks: CueMarks[];
  }): Promise<Highlight[]> {
    const script = await deps.loadScript(input.episodeId);
    if (!script) throw new AppError("EPISODE_NOT_READY");
    const tokenCountByCue = new Map(script.lines.map((line) => [line.cueId, tokenize(line.text).length]));
    const desired = spansFromMarks(input.marks, tokenCountByCue);
    const desiredKeys = new Set(desired.map(spanKey));
    const existing = await deps.highlights.listForEpisode(input.userId, input.episodeId);
    const existingKeys = new Set(existing.map(spanKey));

    const removed = existing.filter((highlight) => !desiredKeys.has(spanKey(highlight)));
    const removedIds = removed.map((highlight) => highlight.id);
    const removedFromCatalog = removed.filter((highlight) => highlight.shareScope === "catalog");
    const added = desired
      .filter((span) => !existingKeys.has(spanKey(span)))
      .map((span) => ({ ...span, id: deps.ids.next() }));

    if (removedIds.length > 0) await deps.highlights.deleteByIds(input.userId, removedIds);
    if (removedFromCatalog.length > 0)
      await deps.highlights.recountStats(input.episodeId, removedFromCatalog);
    if (added.length > 0)
      await deps.highlights.insert(input.userId, input.episodeId, added, deps.clock.now());
    return deps.highlights.listForEpisode(input.userId, input.episodeId);
  };
}

export function makeGetReadingView(deps: Pick<Deps, "highlights" | "loadScript">) {
  return async function getReadingView(userId: string, episodeId: string): Promise<ReadingView> {
    const script = await deps.loadScript(episodeId);
    if (!script) throw new AppError("EPISODE_NOT_READY");
    const [highlights, stats] = await Promise.all([
      deps.highlights.listForEpisode(userId, episodeId),
      deps.highlights.listStats(episodeId),
    ]);
    const counts = visibleMarkCounts(stats);
    return {
      episodeId,
      hasPortuguese: script.hasPortuguese,
      highlights,
      lines: script.lines.map((line) => ({
        ...line,
        tokens: tokenize(line.text),
        markedByCount: counts.get(line.cueId) ?? null,
      })),
    };
  };
}

export function makeListPendingHighlights(deps: Pick<Deps, "highlights">) {
  return async function listPendingHighlights(userId: string, episodeId: string): Promise<Highlight[]> {
    const all = await deps.highlights.listForEpisode(userId, episodeId);
    return all.filter((highlight) => highlight.cardBatchId === null);
  };
}

export function makeMarkHighlightsCarded(deps: Pick<Deps, "highlights">) {
  return async function markHighlightsCarded(input: {
    userId: string;
    episodeId: string;
    highlightIds: string[];
    batchId: string;
    scope: ShareScope;
  }): Promise<void> {
    if (input.highlightIds.length === 0) return;
    const newlyShared = await deps.highlights.markCarded(input);
    if (newlyShared.length > 0) await deps.highlights.recountStats(input.episodeId, newlyShared);
  };
}
