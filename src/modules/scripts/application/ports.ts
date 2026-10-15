import type { StudyLanguage } from "@/shared/study-languages";
import type { MatchedLine, ScriptStatus } from "../domain/script";

export type ScriptSource = "upload" | "ai_search";

export type StoredScript = {
  id: string;
  episodeId: string;
  language: StudyLanguage;
  source: ScriptSource;
  sourceUrl: string | null;
  sha256: string;
  status: ScriptStatus;
  lineCount: number;
  matchedCount: number;
  cueCount: number;
  uploadedBy: string | null;
};

export type NewScript = Omit<StoredScript, "id" | "uploadedBy"> & {
  id: string;
  storagePath: string;
  uploadedBy: string;
  lines: (MatchedLine & { id: string })[];
  now: Date;
};

export type ScriptCompletionRow = { cueId: string; cueText: string; lineText: string };

export interface ScriptRepository {
  find(episodeId: string, language: StudyLanguage): Promise<StoredScript | null>;
  replace(script: NewScript): Promise<void>;
  listMatchedLines(episodeId: string, language: StudyLanguage): Promise<ScriptCompletionRow[]>;
}

export type LoadCues = (
  episodeId: string,
  language: StudyLanguage,
) => Promise<{ id: string; text: string }[] | null>;
