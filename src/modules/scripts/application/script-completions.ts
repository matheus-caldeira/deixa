import type { StudyLanguage } from "@/shared/study-languages";
import { completesCue } from "../domain/script";
import type { ScriptRepository, StoredScript } from "./ports";

export type ScriptSummary = Pick<StoredScript, "status" | "matchedCount" | "cueCount" | "lineCount">;

export function makeListScriptCompletions(deps: { scripts: ScriptRepository }) {
  return async function listScriptCompletions(
    episodeId: string,
    language: StudyLanguage,
  ): Promise<Map<string, string>> {
    const rows = await deps.scripts.listMatchedLines(episodeId, language);
    const completions = new Map<string, string>();
    for (const row of rows) {
      if (completesCue(row.cueText, row.lineText)) completions.set(row.cueId, row.lineText);
    }
    return completions;
  };
}

export function makeGetScriptSummary(deps: { scripts: ScriptRepository }) {
  return async function getScriptSummary(
    episodeId: string,
    language: StudyLanguage,
  ): Promise<ScriptSummary | null> {
    const script = await deps.scripts.find(episodeId, language);
    if (!script) return null;
    const { status, matchedCount, cueCount, lineCount } = script;
    return { status, matchedCount, cueCount, lineCount };
  };
}
