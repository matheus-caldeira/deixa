import type { SubtitleLanguage } from "../../domain/srt";
import type {
  EpisodeLocation,
  FindEpisodeLocation,
  ImportRecord,
  ProcessingStep,
  StoredAlignment,
  StoredCue,
  StoredSubtitleFile,
  SubtitleRepository,
} from "../ports";

export class InMemorySubtitles implements SubtitleRepository {
  readonly files = new Map<string, StoredSubtitleFile & { episodeId: string }>();
  readonly cues = new Map<string, StoredCue[]>();
  readonly alignments = new Map<string, StoredAlignment[]>();
  readonly translations = new Map<string, string>();
  readonly episodeStatus = new Map<
    string,
    { status: string; cueCount: number; alignmentRate: number | null }
  >();
  readonly jobs: { episodeId: string; status: string; steps: ProcessingStep[]; reason?: string }[] = [];
  failNextSave = false;

  async listFiles(episodeId: string): Promise<StoredSubtitleFile[]> {
    return [...this.files.values()].filter((file) => file.episodeId === episodeId);
  }

  async listCues(subtitleFileId: string): Promise<StoredCue[]> {
    return this.cues.get(subtitleFileId) ?? [];
  }

  async listAlignments(episodeId: string): Promise<StoredAlignment[]> {
    return this.alignments.get(episodeId) ?? [];
  }

  async listCueTranslations(): Promise<Map<string, string>> {
    return new Map(this.translations);
  }

  async saveCueTranslation(cueId: string, text: string, _now?: Date): Promise<void> {
    if (!this.translations.has(cueId)) this.translations.set(cueId, text);
  }

  async findCue(
    cueId: string,
  ): Promise<(StoredCue & { episodeId: string; language: SubtitleLanguage }) | null> {
    for (const [fileId, cues] of this.cues) {
      const cue = cues.find((candidate) => candidate.id === cueId);
      const file = this.files.get(fileId);
      if (cue && file) return { ...cue, episodeId: file.episodeId, language: file.language };
    }
    return null;
  }

  async saveImport(record: ImportRecord): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error("banco indisponível");
    }
    for (const file of record.files) {
      const { cues, originalFilename: _originalFilename, sizeBytes: _sizeBytes, ...stored } = file;
      this.files.set(file.id, { ...stored, episodeId: record.episodeId });
      this.cues.set(file.id, cues);
    }
    if (record.alignments) {
      this.alignments.set(
        record.episodeId,
        record.alignments.map(({ id: _id, ...alignment }) => alignment),
      );
    }
    this.episodeStatus.set(record.episodeId, {
      status: "READY",
      cueCount: record.cueCount,
      alignmentRate: record.alignmentRate,
    });
    this.jobs.push({ episodeId: record.episodeId, status: "DONE", steps: record.steps });
  }

  async markFailed(input: { episodeId: string; reason: string; steps: ProcessingStep[] }): Promise<void> {
    this.episodeStatus.set(input.episodeId, { status: "FAILED", cueCount: 0, alignmentRate: null });
    this.jobs.push({
      episodeId: input.episodeId,
      status: "FAILED",
      steps: input.steps,
      reason: input.reason,
    });
  }
}

export function fixedEpisodeLocations(locations: EpisodeLocation[]): FindEpisodeLocation {
  return async (episodeId) => locations.find((location) => location.episodeId === episodeId) ?? null;
}
