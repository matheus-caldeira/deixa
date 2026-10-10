import { tokenize } from "@/shared/text";
import type { Highlight, HighlightSpan, HighlightStat, ShareScope } from "../../domain/highlights";
import type { HighlightRepository, LoadScript, ReadableScript } from "../ports";

type Row = Highlight & { userId: string; episodeId: string };

export class InMemoryHighlights implements HighlightRepository {
  readonly rows: Row[] = [];
  readonly stats: (HighlightStat & { episodeId: string })[] = [];

  async listForEpisode(userId: string, episodeId: string): Promise<Highlight[]> {
    return this.rows
      .filter((row) => row.userId === userId && row.episodeId === episodeId)
      .map(({ userId: _userId, episodeId: _episodeId, ...highlight }) => highlight);
  }

  async insert(userId: string, episodeId: string, spans: (HighlightSpan & { id: string })[]): Promise<void> {
    for (const span of spans) {
      this.rows.push({ ...span, userId, episodeId, shareScope: "private", cardBatchId: null });
    }
  }

  async deleteByIds(userId: string, ids: string[]): Promise<void> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      const row = this.rows[index];
      if (row && row.userId === userId && ids.includes(row.id)) this.rows.splice(index, 1);
    }
  }

  async markCarded(input: {
    userId: string;
    episodeId: string;
    highlightIds: string[];
    batchId: string;
    scope: ShareScope;
  }): Promise<HighlightSpan[]> {
    const newlyShared: HighlightSpan[] = [];
    for (const row of this.rows) {
      if (row.userId !== input.userId || row.episodeId !== input.episodeId) continue;
      if (!input.highlightIds.includes(row.id)) continue;
      if (input.scope === "catalog" && row.shareScope !== "catalog") {
        newlyShared.push({
          cueId: row.cueId,
          startToken: row.startToken,
          endToken: row.endToken,
          kind: row.kind,
        });
        row.shareScope = "catalog";
      }
      row.cardBatchId = input.batchId;
    }
    return newlyShared;
  }

  async recountStats(episodeId: string, spans: HighlightSpan[]): Promise<void> {
    for (const span of spans) {
      const sameSpan = (candidate: { cueId: string; startToken: number; endToken: number }) =>
        candidate.cueId === span.cueId &&
        candidate.startToken === span.startToken &&
        candidate.endToken === span.endToken;
      const users = new Set(
        this.rows
          .filter((row) => row.episodeId === episodeId && row.shareScope === "catalog" && sameSpan(row))
          .map((row) => row.userId),
      );
      const index = this.stats.findIndex((stat) => stat.episodeId === episodeId && sameSpan(stat));
      if (index >= 0) this.stats.splice(index, 1);
      if (users.size > 0) {
        this.stats.push({
          episodeId,
          cueId: span.cueId,
          startToken: span.startToken,
          endToken: span.endToken,
          userCount: users.size,
        });
      }
    }
  }

  async listStats(episodeId: string): Promise<HighlightStat[]> {
    return this.stats
      .filter((stat) => stat.episodeId === episodeId)
      .map(({ episodeId: _episodeId, ...stat }) => stat);
  }
}

export const SAMPLE_LINES = [
  { en: "Hey, what are you up to tonight?", pt: "Ei, o que você vai fazer hoje à noite?" },
  { en: "Nope. I picked up the tab, like an idiot.", pt: "Não. Eu paguei a conta, feito um idiota." },
  { en: "Promise?", pt: null },
] as const;

export function sampleScript(episodeId: string): ReadableScript {
  return {
    episodeId,
    hasPortuguese: true,
    lines: SAMPLE_LINES.map((line, index) => ({
      cueId: `cue-${index + 1}`,
      sequence: index + 1,
      startMs: 65_000 + index * 3000,
      endMs: 67_000 + index * 3000,
      text: line.en,
      sceneIndex: 0,
      startsScene: index === 0,
      translation: line.pt,
      translationSource: line.pt ? ("subtitle_pt" as const) : null,
    })),
  };
}

export function scriptsFor(episodeIds: string[]): LoadScript {
  return async (episodeId) => (episodeIds.includes(episodeId) ? sampleScript(episodeId) : null);
}

export function tokenIndex(text: string, word: string): number {
  return tokenize(text).findIndex((token) => token.toLowerCase().startsWith(word.toLowerCase()));
}
