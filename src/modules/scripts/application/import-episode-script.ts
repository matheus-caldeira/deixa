import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { sha256Hex } from "@/shared/hash";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import type { StudyLanguage } from "@/shared/study-languages";
import {
  decodeSubtitle,
  formatFileSize,
  type EpisodeLocation,
  type FindEpisodeLocation,
  type ProcessingStep,
} from "@/modules/subtitles";
import { matchScriptToCues, parseScriptText, validateScriptFile, type ScriptStatus } from "../domain/script";
import type { LoadCues, ScriptRepository } from "./ports";

export type ScriptImportResult = {
  outcome: "PROCESSED" | "DUPLICATE";
  episodeId: string;
  language: StudyLanguage;
  status: ScriptStatus;
  lineCount: number;
  matchedCount: number;
  cueCount: number;
  steps: ProcessingStep[];
};

const HASH_PREVIEW_CHARS = 4;
const PERCENT = 100;

function episodeDirectory(location: EpisodeLocation): string {
  if (location.mediaType === "movie") return `catalog/movies/${location.mediaId}`;
  return `catalog/series/${location.mediaId}/seasons/${location.seasonNumber}/episodes/${location.episodeId}`;
}

const shortHash = (hash: string): string =>
  `${hash.slice(0, HASH_PREVIEW_CHARS)}…${hash.slice(-HASH_PREVIEW_CHARS)}`;

export function makeImportEpisodeScript(deps: {
  scripts: ScriptRepository;
  loadCues: LoadCues;
  findEpisodeLocation: FindEpisodeLocation;
  storage: FileStorage;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function importEpisodeScript(input: {
    userId: string;
    episodeId: string;
    language: StudyLanguage;
    upload: { filename: string; bytes: Uint8Array };
  }): Promise<ScriptImportResult> {
    validateScriptFile(input.upload);
    const location = await deps.findEpisodeLocation(input.episodeId);
    if (!location) throw new AppError("EPISODE_NOT_FOUND");
    const cues = await deps.loadCues(input.episodeId, input.language);
    if (!cues || cues.length === 0) throw new AppError("SCRIPT_INVALID", "noSubtitle");

    const sha256 = sha256Hex(input.upload.bytes);
    const steps: ProcessingStep[] = [
      {
        key: "validateScript",
        detail: { key: "scriptSize", params: { size: formatFileSize(input.upload.bytes.byteLength) } },
      },
      { key: "hash", detail: { key: "hash", params: { hash: shortHash(sha256) } } },
    ];
    const existing = await deps.scripts.find(input.episodeId, input.language);
    if (existing && existing.sha256 === sha256) {
      return {
        outcome: "DUPLICATE",
        episodeId: input.episodeId,
        language: input.language,
        status: existing.status,
        lineCount: existing.lineCount,
        matchedCount: existing.matchedCount,
        cueCount: existing.cueCount,
        steps: [...steps, { key: "duplicates", detail: { key: "scriptIdentical" } }],
      };
    }

    if (existing && existing.uploadedBy !== input.userId) {
      throw new AppError("SCRIPT_INVALID", "versionConflict");
    }

    const lines = parseScriptText(decodeSubtitle(input.upload.bytes));
    if (lines.length === 0) throw new AppError("SCRIPT_INVALID", "noLines");
    steps.push({ key: "readScript", detail: { key: "scriptLines", params: { count: lines.length } } });

    const match = matchScriptToCues(lines, cues);
    steps.push({
      key: "matchScript",
      detail: {
        key: "scriptMatched",
        params: {
          matched: match.matchedCues,
          total: cues.length,
          percent: `${Math.round(match.rate * PERCENT)}%`,
        },
      },
    });

    const storagePath = `${episodeDirectory(location)}/script.${input.language}.txt`;
    await deps.storage.write(storagePath, input.upload.bytes);
    await deps.scripts.replace({
      id: deps.ids.next(),
      episodeId: input.episodeId,
      language: input.language,
      source: "upload",
      sourceUrl: null,
      sha256,
      storagePath,
      status: match.status,
      lineCount: lines.length,
      matchedCount: match.matchedCues,
      cueCount: cues.length,
      uploadedBy: input.userId,
      lines: match.lines.map((line) => ({ ...line, id: deps.ids.next() })),
      now: deps.clock.now(),
    });
    steps.push({
      key: "publishScript",
      detail: { key: match.status === "VERIFIED" ? "scriptVerified" : "scriptNeedsReview" },
    });

    return {
      outcome: "PROCESSED",
      episodeId: input.episodeId,
      language: input.language,
      status: match.status,
      lineCount: lines.length,
      matchedCount: match.matchedCues,
      cueCount: cues.length,
      steps,
    };
  };
}
