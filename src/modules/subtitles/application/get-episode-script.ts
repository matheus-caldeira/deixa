import { sceneIndexes } from "../domain/srt";
import type { SubtitleRepository } from "./ports";

export type TranslationSource = "subtitle_pt" | "llm";

export type ScriptLine = {
  cueId: string;
  sequence: number;
  startMs: number;
  endMs: number;
  text: string;
  sceneIndex: number;
  startsScene: boolean;
  translation: string | null;
  translationSource: TranslationSource | null;
};

export type EpisodeScript = {
  episodeId: string;
  englishFileId: string;
  hasPortuguese: boolean;
  lines: ScriptLine[];
};

export function makeGetEpisodeScript(deps: { subtitles: SubtitleRepository }) {
  return async function getEpisodeScript(episodeId: string): Promise<EpisodeScript | null> {
    const files = await deps.subtitles.listFiles(episodeId);
    const english = files.find((file) => file.language === "en");
    if (!english) return null;
    const portuguese = files.find((file) => file.language === "pt-BR");
    const [englishCues, portugueseCues, alignments, machineTranslations] = await Promise.all([
      deps.subtitles.listCues(english.id),
      portuguese ? deps.subtitles.listCues(portuguese.id) : Promise.resolve([]),
      deps.subtitles.listAlignments(episodeId),
      deps.subtitles.listCueTranslations(episodeId),
    ]);
    const portugueseById = new Map(portugueseCues.map((cue) => [cue.id, cue]));
    const alignmentByEnglishCue = new Map(alignments.map((alignment) => [alignment.enCueId, alignment]));
    const scenes = sceneIndexes(englishCues);

    const lines = englishCues.map((cue, index): ScriptLine => {
      const alignment = alignmentByEnglishCue.get(cue.id);
      const fromSubtitle =
        alignment?.status === "ALIGNED"
          ? alignment.ptCueIds
              .map((id) => portugueseById.get(id))
              .filter((candidate) => candidate !== undefined)
              .sort((a, b) => a.sequence - b.sequence)
              .map((candidate) => candidate.text)
              .join(" ")
          : "";
      const fromMachine = machineTranslations.get(cue.id) ?? null;
      const sceneIndex = scenes[index] ?? 0;
      return {
        cueId: cue.id,
        sequence: cue.sequence,
        startMs: cue.startMs,
        endMs: cue.endMs,
        text: cue.text,
        sceneIndex,
        startsScene: index === 0 || sceneIndex !== scenes[index - 1],
        translation: fromSubtitle !== "" ? fromSubtitle : fromMachine,
        translationSource: fromSubtitle !== "" ? "subtitle_pt" : fromMachine ? "llm" : null,
      };
    });

    return { episodeId, englishFileId: english.id, hasPortuguese: Boolean(portuguese), lines };
  };
}
