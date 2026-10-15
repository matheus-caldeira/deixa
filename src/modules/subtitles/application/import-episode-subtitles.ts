import { alignCues } from "@/modules/alignment";
import { AppError, isAppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { sha256Hex } from "@/shared/hash";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
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
  StoredCue,
  SubtitleOrigin,
  SubtitleRepository,
} from "./ports";

export type UploadedSubtitle = { filename: string; bytes: Uint8Array; origin?: SubtitleOrigin };

export type ImportResult = {
  outcome: "PROCESSED" | "DUPLICATE";
  episodeId: string;
  steps: ProcessingStep[];
  hasPortuguese: boolean;
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

function prepare(language: SubtitleLanguage, upload: UploadedSubtitle): Prepared {
  validateSubtitleFile(upload);
  return { language, upload, sha256: sha256Hex(upload.bytes) };
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
    if (cues.length === 0) {
      throw new AppError("SUBTITLE_INVALID", "noCues");
    }
    return cues.map((cue) => ({ id: deps.ids.next(), ...cue }));
  }

  return async function importEpisodeSubtitles(input: {
    userId: string;
    episodeId: string;
    english: UploadedSubtitle;
    portuguese?: UploadedSubtitle;
  }): Promise<ImportResult> {
    const location = await deps.findEpisodeLocation(input.episodeId);
    if (!location) throw new AppError("EPISODE_NOT_FOUND");

    const english = prepare("en", input.english);
    const portuguese = input.portuguese ? prepare("pt-BR", input.portuguese) : null;
    const steps: ProcessingStep[] = [
      {
        key: "validate",
        detail: portuguese
          ? {
              key: "bothSizes",
              params: {
                target: formatFileSize(english.upload.bytes.byteLength),
                native: formatFileSize(portuguese.upload.bytes.byteLength),
              },
            }
          : { key: "targetSize", params: { size: formatFileSize(english.upload.bytes.byteLength) } },
      },
      { key: "hash", detail: { key: "hash", params: { hash: shortHash(english.sha256) } } },
    ];

    const existing = await deps.subtitles.listFiles(input.episodeId);
    const existingEnglish = existing.find((file) => file.language === "en");
    const existingPortuguese = existing.find((file) => file.language === "pt-BR");

    if (existingEnglish && existingEnglish.sha256 !== english.sha256) {
      throw new AppError("SUBTITLE_VERSION_CONFLICT", "targetVersionConflict");
    }
    if (portuguese && existingPortuguese && existingPortuguese.sha256 !== portuguese.sha256) {
      throw new AppError("SUBTITLE_VERSION_CONFLICT", "nativeVersionConflict");
    }

    const englishIsNew = !existingEnglish;
    const portugueseIsNew = Boolean(portuguese) && !existingPortuguese;

    if (!englishIsNew && !portugueseIsNew) {
      const cues = existingEnglish ? await deps.subtitles.listCues(existingEnglish.id) : [];
      const alignments = await deps.subtitles.listAlignments(input.episodeId);
      const pairs = alignments.filter((alignment) => alignment.status === "ALIGNED").length;
      return {
        outcome: "DUPLICATE",
        episodeId: input.episodeId,
        steps: [...steps, { key: "duplicates", detail: { key: "identicalFound" } }],
        hasPortuguese: Boolean(existingPortuguese),
        cueCount: cues.length,
        alignment: existingPortuguese && cues.length > 0 ? { pairs, rate: pairs / cues.length } : null,
      };
    }
    steps.push({
      key: "duplicates",
      detail: { key: englishIsNew ? "none" : "addingNative" },
    });

    const jobId = deps.ids.next();
    const now = deps.clock.now();
    try {
      const directory = episodeDirectory(location);
      const newFiles: NewSubtitleFile[] = [];

      let englishCues: StoredCue[];
      if (englishIsNew) {
        const storagePath = `${directory}/original.en.srt`;
        await deps.storage.write(storagePath, english.upload.bytes);
        englishCues = parseToCues(english);
        newFiles.push({
          id: deps.ids.next(),
          language: "en",
          sha256: english.sha256,
          storagePath,
          origin: english.upload.origin ?? null,
          originalFilename: english.upload.filename,
          sizeBytes: english.upload.bytes.byteLength,
          cues: englishCues,
        });
      } else {
        englishCues = existingEnglish ? await deps.subtitles.listCues(existingEnglish.id) : [];
      }
      steps.push({ key: "readTarget", detail: { key: "cues", params: { count: englishCues.length } } });

      let portugueseCues: StoredCue[] | null = null;
      if (portuguese && portugueseIsNew) {
        const storagePath = `${directory}/original.pt-BR.srt`;
        await deps.storage.write(storagePath, portuguese.upload.bytes);
        portugueseCues = parseToCues(portuguese);
        newFiles.push({
          id: deps.ids.next(),
          language: "pt-BR",
          sha256: portuguese.sha256,
          storagePath,
          origin: portuguese.upload.origin ?? null,
          originalFilename: portuguese.upload.filename,
          sizeBytes: portuguese.upload.bytes.byteLength,
          cues: portugueseCues,
        });
        steps.push({ key: "readNative", detail: { key: "cues", params: { count: portugueseCues.length } } });
      }

      const alignment = portugueseCues ? alignCues(englishCues, portugueseCues) : null;
      if (alignment) {
        steps.push({
          key: "align",
          detail: {
            key: "pairs",
            params: { count: alignment.alignedCount, percent: percent(alignment.rate) },
          },
        });
        await deps.storage.write(
          `${directory}/alignment.json`,
          new TextEncoder().encode(JSON.stringify(alignment, null, 2)),
        );
      }
      steps.push({ key: "publish", detail: { key: "ready" } });
      steps.push({ key: "audio", detail: { key: "onDemand" } });

      await deps.subtitles.saveImport({
        episodeId: input.episodeId,
        userId: input.userId,
        now,
        jobId,
        files: newFiles,
        alignments: alignment
          ? alignment.alignments.map((entry) => ({ id: deps.ids.next(), ...entry }))
          : null,
        cueCount: englishCues.length,
        alignmentPairs: alignment ? alignment.alignedCount : null,
        alignmentRate: alignment ? alignment.rate : null,
        steps,
      });

      return {
        outcome: "PROCESSED",
        episodeId: input.episodeId,
        steps,
        hasPortuguese: Boolean(portugueseCues) || Boolean(existingPortuguese),
        cueCount: englishCues.length,
        alignment: alignment ? { pairs: alignment.alignedCount, rate: alignment.rate } : null,
      };
    } catch (error) {
      if (isAppError(error) && error.code === "SUBTITLE_INVALID") throw error;
      await deps.subtitles.markFailed({
        episodeId: input.episodeId,
        userId: input.userId,
        jobId,
        reason: error instanceof Error ? error.message : "falha desconhecida",
        steps,
        now,
      });
      throw error;
    }
  };
}
