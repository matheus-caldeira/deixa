import { and, eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { episodeScripts, scriptLines, subtitleCues } from "@/infrastructure/database/schema";
import { normalizeLanguageTag, type StudyLanguage } from "@/shared/study-languages";
import type { ScriptStatus } from "../domain/script";
import type {
  NewScript,
  ScriptCompletionRow,
  ScriptRepository,
  ScriptSource,
  StoredScript,
} from "../application/ports";

const SOURCES: readonly ScriptSource[] = ["upload", "ai_search"];
const STATUSES: readonly ScriptStatus[] = ["VERIFIED", "NEEDS_REVIEW"];
const LINE_CHUNK = 500;

export class DrizzleScriptRepository implements ScriptRepository {
  constructor(private readonly db: Database) {}

  async find(episodeId: string, language: StudyLanguage): Promise<StoredScript | null> {
    const [row] = await this.db
      .select()
      .from(episodeScripts)
      .where(and(eq(episodeScripts.episodeId, episodeId), eq(episodeScripts.language, language)))
      .limit(1);
    if (!row) return null;
    const normalized = normalizeLanguageTag(row.language);
    if (!normalized) return null;
    return {
      id: row.id,
      episodeId: row.episodeId,
      language: normalized,
      source: SOURCES.find((source) => source === row.source) ?? "upload",
      sourceUrl: row.sourceUrl,
      sha256: row.sha256,
      status: STATUSES.find((status) => status === row.status) ?? "NEEDS_REVIEW",
      lineCount: row.lineCount,
      matchedCount: row.matchedCount,
      cueCount: row.cueCount,
      uploadedBy: row.uploadedBy,
    };
  }

  async replace(script: NewScript): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(episodeScripts)
        .where(
          and(eq(episodeScripts.episodeId, script.episodeId), eq(episodeScripts.language, script.language)),
        );
      await tx.insert(episodeScripts).values({
        id: script.id,
        episodeId: script.episodeId,
        language: script.language,
        source: script.source,
        sourceUrl: script.sourceUrl,
        storagePath: script.storagePath,
        sha256: script.sha256,
        status: script.status,
        lineCount: script.lineCount,
        matchedCount: script.matchedCount,
        cueCount: script.cueCount,
        uploadedBy: script.uploadedBy,
        createdAt: script.now,
      });
      for (let start = 0; start < script.lines.length; start += LINE_CHUNK) {
        await tx.insert(scriptLines).values(
          script.lines.slice(start, start + LINE_CHUNK).map((line) => ({
            id: line.id,
            scriptId: script.id,
            sequence: line.sequence,
            text: line.text,
            matchedCueId: line.matchedCueId,
            verified: line.verified,
          })),
        );
      }
    });
  }

  async listMatchedLines(episodeId: string, language: StudyLanguage): Promise<ScriptCompletionRow[]> {
    const rows = await this.db
      .select({ cueId: subtitleCues.id, cueText: subtitleCues.text, lineText: scriptLines.text })
      .from(scriptLines)
      .innerJoin(episodeScripts, eq(scriptLines.scriptId, episodeScripts.id))
      .innerJoin(subtitleCues, eq(scriptLines.matchedCueId, subtitleCues.id))
      .where(
        and(
          eq(episodeScripts.episodeId, episodeId),
          eq(episodeScripts.language, language),
          isNotNull(scriptLines.matchedCueId),
        ),
      );
    return rows;
  }
}
