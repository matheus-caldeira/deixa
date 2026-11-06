import type { AlignmentStatus } from "@/modules/alignment";
import type { StudyLanguage } from "@/shared/study-languages";
import type { SubtitleLanguage } from "../domain/srt";

export type SubtitleOrigin = {
  source: "opensubtitles";
  externalFileId: string;
  releaseName: string | null;
  author: string | null;
  hearingImpaired: boolean | null;
  fps: number | null;
};

export type StoredSubtitleFile = {
  id: string;
  language: SubtitleLanguage;
  sha256: string;
  storagePath: string;
  origin: SubtitleOrigin | null;
};
export type StoredCue = { id: string; sequence: number; startMs: number; endMs: number; text: string };
export type StoredAlignment = {
  sourceCueId: string;
  alignedLanguage: StudyLanguage;
  alignedCueIds: string[];
  overlapScore: number;
  offsetMs: number;
  status: AlignmentStatus;
};
export type ProcessingStep = {
  key: string;
  detail: { key: string; params?: Record<string, string | number> };
};

export type NewSubtitleFile = StoredSubtitleFile & {
  originalFilename: string;
  sizeBytes: number;
  cues: StoredCue[];
};

export type ImportRecord = {
  episodeId: string;
  userId: string;
  now: Date;
  jobId: string;
  files: NewSubtitleFile[];
  alignments: (StoredAlignment & { id: string })[];
  cueCount: number;
  alignmentPairs: number | null;
  alignmentRate: number | null;
  steps: ProcessingStep[];
};

export interface SubtitleRepository {
  listFiles(episodeId: string): Promise<StoredSubtitleFile[]>;
  listCues(subtitleFileId: string): Promise<StoredCue[]>;
  listAlignments(episodeId: string, alignedLanguage: StudyLanguage): Promise<StoredAlignment[]>;
  listCueTranslations(episodeId: string, locale: StudyLanguage): Promise<Map<string, string>>;
  saveCueTranslation(cueId: string, locale: StudyLanguage, text: string, now: Date): Promise<void>;
  findCue(cueId: string): Promise<(StoredCue & { episodeId: string; language: SubtitleLanguage }) | null>;
  saveImport(record: ImportRecord): Promise<void>;
  markFailed(input: {
    episodeId: string;
    userId: string;
    jobId: string;
    reason: string;
    steps: ProcessingStep[];
    now: Date;
  }): Promise<void>;
}

export type EpisodeLocation = {
  episodeId: string;
  mediaId: string;
  mediaType: "series" | "movie" | "music";
  seasonNumber: number;
};

export type FindEpisodeLocation = (episodeId: string) => Promise<EpisodeLocation | null>;
