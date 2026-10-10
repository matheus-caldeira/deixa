export type HighlightKind = "word" | "phrase" | "line";
export type ShareScope = "private" | "catalog";

export type HighlightSpan = { cueId: string; startToken: number; endToken: number; kind: HighlightKind };
export type Highlight = HighlightSpan & { id: string; shareScope: ShareScope; cardBatchId: string | null };
export type CueMarks = { cueId: string; tokens: number[]; wholeLine: boolean };
export type HighlightStat = { cueId: string; startToken: number; endToken: number; userCount: number };

export const MIN_HIGHLIGHT_COUNT_TO_SHOW = 2;

export function tokenRuns(indices: readonly number[]): [number, number][] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const index of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[1] === index - 1) last[1] = index;
    else runs.push([index, index]);
  }
  return runs;
}

export function spanKey(span: HighlightSpan): string {
  return `${span.cueId}:${span.startToken}:${span.endToken}:${span.kind}`;
}

export function spansFromMarks(
  marks: readonly CueMarks[],
  tokenCountByCue: ReadonlyMap<string, number>,
): HighlightSpan[] {
  const spans = new Map<string, HighlightSpan>();
  for (const mark of marks) {
    const tokenCount = tokenCountByCue.get(mark.cueId);
    if (!tokenCount) continue;
    const validTokens = mark.tokens.filter(
      (token) => Number.isInteger(token) && token >= 0 && token < tokenCount,
    );
    for (const [startToken, endToken] of tokenRuns(validTokens)) {
      const span: HighlightSpan = {
        cueId: mark.cueId,
        startToken,
        endToken,
        kind: startToken === endToken ? "word" : "phrase",
      };
      spans.set(spanKey(span), span);
    }
    if (mark.wholeLine) {
      const span: HighlightSpan = {
        cueId: mark.cueId,
        startToken: 0,
        endToken: tokenCount - 1,
        kind: "line",
      };
      spans.set(spanKey(span), span);
    }
  }
  return [...spans.values()];
}

export function visibleMarkCounts(stats: readonly HighlightStat[]): Map<string, number> {
  const highestByCue = new Map<string, number>();
  for (const stat of stats) {
    highestByCue.set(stat.cueId, Math.max(highestByCue.get(stat.cueId) ?? 0, stat.userCount));
  }
  return new Map([...highestByCue].filter(([, count]) => count >= MIN_HIGHLIGHT_COUNT_TO_SHOW));
}
