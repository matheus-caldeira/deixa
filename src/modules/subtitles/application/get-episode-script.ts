import type { LanguagePair } from "@/shared/study-languages";
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
  pair: LanguagePair;
  targetFileId: string;
  hasNative: boolean;
  lines: ScriptLine[];
};

export function makeGetEpisodeScript(deps: { subtitles: SubtitleRepository }) {
  return async function getEpisodeScript(
    episodeId: string,
    pair: LanguagePair,
  ): Promise<EpisodeScript | null> {
    const files = await deps.subtitles.listFiles(episodeId);
    const target = files.find((file) => file.language === pair.target);
    if (!target) return null;
    const native = files.find((file) => file.language === pair.native);
    const [targetCues, nativeCues, alignments, machineTranslations] = await Promise.all([
      deps.subtitles.listCues(target.id),
      native ? deps.subtitles.listCues(native.id) : Promise.resolve([]),
      native ? deps.subtitles.listAlignments(episodeId, pair.native) : Promise.resolve([]),
      deps.subtitles.listCueTranslations(episodeId, pair.native),
    ]);
    const nativeById = new Map(nativeCues.map((cue) => [cue.id, cue]));
    const alignmentBySourceCue = new Map(alignments.map((alignment) => [alignment.sourceCueId, alignment]));
    const scenes = sceneIndexes(targetCues);

    const lines = targetCues.map((cue, index): ScriptLine => {
      const alignment = alignmentBySourceCue.get(cue.id);
      const fromSubtitle =
        alignment?.status === "ALIGNED"
          ? alignment.alignedCueIds
              .map((id) => nativeById.get(id))
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

    return { episodeId, pair, targetFileId: target.id, hasNative: Boolean(native), lines };
  };
}
