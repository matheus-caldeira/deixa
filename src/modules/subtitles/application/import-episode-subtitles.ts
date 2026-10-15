import { alignCues } from "@/modules/alignment";
import { AppError, isAppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { sha256Hex } from "@/shared/hash";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import type { StudyLanguage } from "@/shared/study-languages";
import {
  decodeSubtitle,
  formatFileSize,
  parseSrt,
  validateSubtitleFile,
  type SubtitleLanguage,
} from "../domain/srt";
import type {
  EpisodeLocation,
  FindEpisodeLocation,
  NewSubtitleFile,
  ProcessingStep,
  StoredAlignment,
  StoredCue,
  StoredSubtitleFile,
  SubtitleOrigin,
  SubtitleRepository,
} from "./ports";

export type UploadedSubtitle = { filename: string; bytes: Uint8Array; origin?: SubtitleOrigin };
export type AudioMode = "onDemand" | "queued";
export type SubtitleUpload = { language: StudyLanguage; upload: UploadedSubtitle };

export type ImportResult = {
  outcome: "PROCESSED" | "DUPLICATE";
  episodeId: string;
  steps: ProcessingStep[];
  languages: StudyLanguage[];
  hasNative: boolean;
  cueCount: number;
  alignment: { pairs: number; rate: number } | null;
};

const HASH_PREVIEW_CHARS = 4;
const PERCENT = 100;

function episodeDirectory(location: EpisodeLocation): string {
  if (location.mediaType === "movie") return `catalog/movies/${location.mediaId}`;
  return `catalog/series/${location.mediaId}/seasons/${location.seasonNumber}/episodes/${location.episodeId}`;
}

const shortHash = (hash: string): string =>
  `${hash.slice(0, HASH_PREVIEW_CHARS)}…${hash.slice(-HASH_PREVIEW_CHARS)}`;
const percent = (rate: number): string => `${Math.round(rate * PERCENT)}%`;

type Prepared = { language: SubtitleLanguage; upload: UploadedSubtitle; sha256: string };
type FileWithCues = { id: string; language: StudyLanguage; cues: StoredCue[] };

function prepare(file: SubtitleUpload): Prepared {
  validateSubtitleFile(file.upload);
  return { language: file.language, upload: file.upload, sha256: sha256Hex(file.upload.bytes) };
}

export function makeImportEpisodeSubtitles(deps: {
  subtitles: SubtitleRepository;
  findEpisodeLocation: FindEpisodeLocation;
  storage: FileStorage;
  clock: Clock;
  ids: IdGenerator;
}) {
  function parseToCues(prepared: Prepared): StoredCue[] {
    const { cues } = parseSrt(decodeSubtitle(prepared.upload.bytes));
    if (cues.length === 0) throw new AppError("SUBTITLE_INVALID", "noCues");
    return cues.map((cue) => ({ id: deps.ids.next(), ...cue }));
  }

  async function withCues(file: StoredSubtitleFile): Promise<FileWithCues> {
    return { id: file.id, language: file.language, cues: await deps.subtitles.listCues(file.id) };
  }

  return async function importEpisodeSubtitles(input: {
    userId: string;
    episodeId: string;
    target: SubtitleUpload;
    native?: SubtitleUpload;
    audioMode?: AudioMode;
  }): Promise<ImportResult> {
    if (input.native && input.native.language === input.target.language) {
      throw new AppError("INVALID_INPUT");
    }
    const location = await deps.findEpisodeLocation(input.episodeId);
    if (!location) throw new AppError("EPISODE_NOT_FOUND");

    const target = prepare(input.target);
    const native = input.native ? prepare(input.native) : null;
    const steps: ProcessingStep[] = [
      {
        key: "validate",
        detail: native
          ? {
              key: "bothSizes",
              params: {
                target: formatFileSize(target.upload.bytes.byteLength),
                native: formatFileSize(native.upload.bytes.byteLength),
              },
            }
          : { key: "targetSize", params: { size: formatFileSize(target.upload.bytes.byteLength) } },
      },
      { key: "hash", detail: { key: "hash", params: { hash: shortHash(target.sha256) } } },
    ];

    const existing = await deps.subtitles.listFiles(input.episodeId);
    const existingTarget = existing.find((file) => file.language === target.language);
    const existingNative = native ? existing.find((file) => file.language === native.language) : undefined;

    if (existingTarget && existingTarget.sha256 !== target.sha256) {
      throw new AppError("SUBTITLE_VERSION_CONFLICT", "targetVersionConflict");
    }
    if (native && existingNative && existingNative.sha256 !== native.sha256) {
      throw new AppError("SUBTITLE_VERSION_CONFLICT", "nativeVersionConflict");
    }

    const targetIsNew = !existingTarget;
    const nativeIsNew = Boolean(native) && !existingNative;
    const nativeLanguage = native?.language ?? null;

    if (!targetIsNew && !nativeIsNew) {
      const cues = existingTarget ? await deps.subtitles.listCues(existingTarget.id) : [];
      const alignments = nativeLanguage
        ? await deps.subtitles.listAlignments(input.episodeId, nativeLanguage)
        : [];
      const pairs = alignments.filter((alignment) => alignment.status === "ALIGNED").length;
      return {
        outcome: "DUPLICATE",
        episodeId: input.episodeId,
        steps: [...steps, { key: "duplicates", detail: { key: "identicalFound" } }],
        languages: existing.map((file) => file.language),
        hasNative: Boolean(existingNative),
        cueCount: cues.length,
        alignment: existingNative && cues.length > 0 ? { pairs, rate: pairs / cues.length } : null,
      };
    }
    steps.push({ key: "duplicates", detail: { key: targetIsNew ? "none" : "addingNative" } });

    const jobId = deps.ids.next();
    const now = deps.clock.now();
    try {
      const directory = episodeDirectory(location);
      const newFiles: NewSubtitleFile[] = [];
      const added: FileWithCues[] = [];

      const store = async (prepared: Prepared): Promise<FileWithCues> => {
        const storagePath = `${directory}/original.${prepared.language}.srt`;
        await deps.storage.write(storagePath, prepared.upload.bytes);
        const cues = parseToCues(prepared);
        const file: NewSubtitleFile = {
          id: deps.ids.next(),
          language: prepared.language,
          sha256: prepared.sha256,
          storagePath,
          origin: prepared.upload.origin ?? null,
          originalFilename: prepared.upload.filename,
          sizeBytes: prepared.upload.bytes.byteLength,
          cues,
        };
        newFiles.push(file);
        added.push({ id: file.id, language: file.language, cues });
        return { id: file.id, language: file.language, cues };
      };

      const targetFile = existingTarget ? await withCues(existingTarget) : await store(target);
      steps.push({ key: "readTarget", detail: { key: "cues", params: { count: targetFile.cues.length } } });

      let nativeFile: FileWithCues | null = null;
      if (native && nativeIsNew) {
        nativeFile = await store(native);
        steps.push({ key: "readNative", detail: { key: "cues", params: { count: nativeFile.cues.length } } });
      } else if (existingNative) {
        nativeFile = await withCues(existingNative);
      }

      const others = await Promise.all(
        existing
          .filter((file) => file.id !== existingTarget?.id && file.id !== existingNative?.id)
          .map(withCues),
      );
      const all = [...others, targetFile, ...(nativeFile ? [nativeFile] : [])];
      const addedIds = new Set(added.map((file) => file.id));
      const alignments: (StoredAlignment & { id: string })[] = [];
      let pairAlignment: { pairs: number; rate: number } | null = null;
      for (const source of all) {
        for (const aligned of all) {
          if (source.language === aligned.language) continue;
          if (!addedIds.has(source.id) && !addedIds.has(aligned.id)) continue;
          const result = alignCues(source.cues, aligned.cues);
          for (const entry of result.alignments) {
            alignments.push({ id: deps.ids.next(), alignedLanguage: aligned.language, ...entry });
          }
          if (source.id === targetFile.id && nativeFile && aligned.id === nativeFile.id) {
            pairAlignment = { pairs: result.alignedCount, rate: result.rate };
            steps.push({
              key: "align",
              detail: {
                key: "pairs",
                params: { count: result.alignedCount, percent: percent(result.rate) },
              },
            });
          }
        }
      }
      steps.push({ key: "publish", detail: { key: "ready" } });
      steps.push({ key: "audio", detail: { key: input.audioMode ?? "onDemand" } });

      await deps.subtitles.saveImport({
        episodeId: input.episodeId,
        userId: input.userId,
        now,
        jobId,
        files: newFiles,
        alignments,
        cueCount: targetFile.cues.length,
        alignmentPairs: pairAlignment ? pairAlignment.pairs : null,
        alignmentRate: pairAlignment ? pairAlignment.rate : null,
        steps,
      });

      return {
        outcome: "PROCESSED",
        episodeId: input.episodeId,
        steps,
        languages: all.map((file) => file.language),
        hasNative: nativeFile !== null,
        cueCount: targetFile.cues.length,
        alignment: pairAlignment,
      };
    } catch (error) {
      if (isAppError(error) && error.code === "SUBTITLE_INVALID") throw error;
      await deps.subtitles.markFailed({
        episodeId: input.episodeId,
        userId: input.userId,
        jobId,
        reason: error instanceof Error ? error.message : "unknown failure",
        steps,
        now,
      });
      throw error;
    }
  };
}
