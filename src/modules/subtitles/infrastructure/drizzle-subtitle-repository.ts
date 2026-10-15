import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import {
  cueAlignments,
  cueTranslations,
  episodes,
  processingJobs,
  subtitleCues,
  subtitleFiles,
} from "@/infrastructure/database/schema";
import { isStudyLanguage, type StudyLanguage } from "@/shared/study-languages";
import { SUBTITLE_PROCESSING_VERSION, type SubtitleLanguage } from "../domain/srt";
import type {
  ImportRecord,
  ProcessingStep,
  StoredAlignment,
  StoredCue,
  StoredSubtitleFile,
  SubtitleRepository,
} from "../application/ports";

const INSERT_CHUNK = 500;

const toLanguage = (value: string): SubtitleLanguage => (isStudyLanguage(value) ? value : "en");

function chunks<Item>(items: Item[]): Item[][] {
  const result: Item[][] = [];
  for (let index = 0; index < items.length; index += INSERT_CHUNK)
    result.push(items.slice(index, index + INSERT_CHUNK));
  return result;
}

export class DrizzleSubtitleRepository implements SubtitleRepository {
  constructor(private readonly db: Database) {}

  async listFiles(episodeId: string): Promise<StoredSubtitleFile[]> {
    const rows = await this.db.select().from(subtitleFiles).where(eq(subtitleFiles.episodeId, episodeId));
    return rows.map((row) => ({
      id: row.id,
      language: toLanguage(row.language),
      sha256: row.sha256,
      storagePath: row.storagePath,
      origin:
        row.source === "opensubtitles" && row.externalFileId
          ? {
              source: "opensubtitles" as const,
              externalFileId: row.externalFileId,
              releaseName: row.releaseName,
              author: row.sourceAuthor,
              hearingImpaired: row.hearingImpaired,
              fps: row.fps,
            }
          : null,
    }));
  }

  async listCues(subtitleFileId: string): Promise<StoredCue[]> {
    return this.db
      .select({
        id: subtitleCues.id,
        sequence: subtitleCues.sequence,
        startMs: subtitleCues.startMs,
        endMs: subtitleCues.endMs,
        text: subtitleCues.text,
      })
      .from(subtitleCues)
      .where(eq(subtitleCues.subtitleFileId, subtitleFileId))
      .orderBy(asc(subtitleCues.sequence));
  }

  async listAlignments(episodeId: string, alignedLanguage: StudyLanguage): Promise<StoredAlignment[]> {
    const rows = await this.db
      .select()
      .from(cueAlignments)
      .where(and(eq(cueAlignments.episodeId, episodeId), eq(cueAlignments.targetLanguage, alignedLanguage)));
    return rows.map((row) => ({
      sourceCueId: row.sourceCueId,
      alignedLanguage,
      alignedCueIds: row.alignedCueIds,
      overlapScore: row.overlapScore,
      offsetMs: row.offsetMs,
      status: row.status === "ALIGNED" ? "ALIGNED" : "UNALIGNED",
    }));
  }

  async listCueTranslations(episodeId: string, locale: StudyLanguage): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ cueId: cueTranslations.cueId, text: cueTranslations.text })
      .from(cueTranslations)
      .innerJoin(subtitleCues, eq(subtitleCues.id, cueTranslations.cueId))
      .innerJoin(subtitleFiles, eq(subtitleFiles.id, subtitleCues.subtitleFileId))
      .where(and(eq(subtitleFiles.episodeId, episodeId), eq(cueTranslations.locale, locale)));
    return new Map(rows.map((row) => [row.cueId, row.text]));
  }

  async saveCueTranslation(cueId: string, locale: StudyLanguage, text: string, now: Date): Promise<void> {
    await this.db
      .insert(cueTranslations)
      .values({ cueId, locale, text, source: "llm", createdAt: now })
      .onConflictDoNothing();
  }

  async findCue(
    cueId: string,
  ): Promise<(StoredCue & { episodeId: string; language: SubtitleLanguage }) | null> {
    const [row] = await this.db
      .select({
        id: subtitleCues.id,
        sequence: subtitleCues.sequence,
        startMs: subtitleCues.startMs,
        endMs: subtitleCues.endMs,
        text: subtitleCues.text,
        episodeId: subtitleFiles.episodeId,
        language: subtitleFiles.language,
      })
      .from(subtitleCues)
      .innerJoin(subtitleFiles, eq(subtitleFiles.id, subtitleCues.subtitleFileId))
      .where(eq(subtitleCues.id, cueId))
      .limit(1);
    return row ? { ...row, language: toLanguage(row.language) } : null;
  }

  async saveImport(record: ImportRecord): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const file of record.files) {
        await tx.insert(subtitleFiles).values({
          id: file.id,
          episodeId: record.episodeId,
          language: file.language,
          format: "srt",
          storagePath: file.storagePath,
          sha256: file.sha256,
          status: "READY",
          processingVersion: SUBTITLE_PROCESSING_VERSION,
          originalFilename: file.originalFilename,
          sizeBytes: file.sizeBytes,
          uploadedBy: record.userId,
          source: file.origin?.source ?? "upload",
          externalFileId: file.origin?.externalFileId ?? null,
          releaseName: file.origin?.releaseName ?? null,
          sourceAuthor: file.origin?.author ?? null,
          hearingImpaired: file.origin?.hearingImpaired ?? null,
          fps: file.origin?.fps ?? null,
          createdAt: record.now,
        });
        for (const batch of chunks(file.cues)) {
          await tx.insert(subtitleCues).values(batch.map((cue) => ({ ...cue, subtitleFileId: file.id })));
        }
      }
      const sourceCueIds = [...new Set(record.alignments.map((alignment) => alignment.sourceCueId))];
      if (sourceCueIds.length > 0) {
        await tx.delete(cueAlignments).where(inArray(cueAlignments.sourceCueId, sourceCueIds));
      }
      for (const batch of chunks(record.alignments)) {
        await tx.insert(cueAlignments).values(
          batch.map(({ alignedLanguage, ...alignment }) => ({
            ...alignment,
            targetLanguage: alignedLanguage,
            episodeId: record.episodeId,
          })),
        );
      }
      await tx
        .update(episodes)
        .set({
          status: "READY",
          failureReason: null,
          cueCount: record.cueCount,
          ...(record.alignmentPairs !== null
            ? { alignmentPairs: record.alignmentPairs, alignmentRate: record.alignmentRate }
            : {}),
          uploadedBy: record.userId,
          readyAt: record.now,
        })
        .where(eq(episodes.id, record.episodeId));
      await tx.insert(processingJobs).values({
        id: record.jobId,
        episodeId: record.episodeId,
        kind: "subtitle_import",
        status: "DONE",
        attempts: 1,
        steps: record.steps,
        failureReason: null,
        createdBy: record.userId,
        createdAt: record.now,
        updatedAt: record.now,
      });
    });
  }

  async markFailed(input: {
    episodeId: string;
    userId: string;
    jobId: string;
    reason: string;
    steps: ProcessingStep[];
    now: Date;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: subtitleFiles.id })
        .from(subtitleFiles)
        .where(eq(subtitleFiles.episodeId, input.episodeId));
      if (existing.length === 0) {
        await tx
          .update(episodes)
          .set({ status: "FAILED", failureReason: input.reason.slice(0, 300) })
          .where(eq(episodes.id, input.episodeId));
      }
      await tx.insert(processingJobs).values({
        id: input.jobId,
        episodeId: input.episodeId,
        kind: "subtitle_import",
        status: "FAILED",
        attempts: 1,
        steps: input.steps,
        failureReason: input.reason.slice(0, 300),
        createdBy: input.userId,
        createdAt: input.now,
        updatedAt: input.now,
      });
    });
  }
}
