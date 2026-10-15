import type { LanguagePair } from "@/shared/study-languages";
import type { Highlight, HighlightSpan, HighlightStat, ShareScope } from "../domain/highlights";

export interface HighlightRepository {
  listForEpisode(userId: string, episodeId: string): Promise<Highlight[]>;
  insert(
    userId: string,
    episodeId: string,
    spans: (HighlightSpan & { id: string })[],
    now: Date,
  ): Promise<void>;
  deleteByIds(userId: string, ids: string[]): Promise<void>;
  markCarded(input: {
    userId: string;
    episodeId: string;
    highlightIds: string[];
    batchId: string;
    scope: ShareScope;
  }): Promise<HighlightSpan[]>;
  recountStats(episodeId: string, spans: HighlightSpan[]): Promise<void>;
  listStats(episodeId: string): Promise<HighlightStat[]>;
}

export type ReadableLine = {
  cueId: string;
  sequence: number;
  startMs: number;
  endMs: number;
  text: string;
  sceneIndex: number;
  startsScene: boolean;
  translation: string | null;
  translationSource: "subtitle_pt" | "llm" | null;
};

export type ReadableScript = { episodeId: string; hasNative: boolean; lines: ReadableLine[] };
export type LoadScript = (episodeId: string, pair: LanguagePair) => Promise<ReadableScript | null>;
