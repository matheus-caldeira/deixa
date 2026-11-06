import { AppError, isAppError } from "@/shared/errors";
import type { LanguagePair } from "@/shared/study-languages";
import { cuesToSrt } from "../domain/lrc";
import type { Actor } from "../domain/music";
import { applyTranslatedLines, translatedSongLinesSchema } from "../domain/translation";
import { loadEditableSong } from "./access";
import type { MusicRepository, ResolveSongLlm, SongSubtitles } from "./ports";

const encoder = new TextEncoder();

export type TranslateOutcome = "translated" | "skipped";

export function makeRequestSongTranslation(deps: { music: MusicRepository; subtitles: SongSubtitles }) {
  return async function requestSongTranslation(
    input: Actor & { episodeId: string; pair: LanguagePair },
  ): Promise<{ schedule: boolean }> {
    await loadEditableSong(deps.music, input.episodeId, input);
    if (input.pair.native === input.pair.target) return { schedule: false };
    const native = await deps.subtitles.listCues(input.episodeId, input.pair.native);
    return { schedule: native === null || native.length === 0 };
  };
}

export function makeTranslateSong(deps: {
  music: MusicRepository;
  subtitles: SongSubtitles;
  resolveLlm: ResolveSongLlm;
}) {
  return async function translateSong(input: {
    userId: string;
    episodeId: string;
    pair: LanguagePair;
  }): Promise<{ outcome: TranslateOutcome; lines: number }> {
    const song = await deps.music.findSong(input.episodeId);
    if (!song || input.pair.native === input.pair.target) return { outcome: "skipped", lines: 0 };
    const existing = await deps.subtitles.listCues(input.episodeId, input.pair.native);
    if (existing && existing.length > 0) return { outcome: "skipped", lines: 0 };
    const cues = await deps.subtitles.listCues(input.episodeId, input.pair.target);
    const original = await deps.subtitles.readOriginal(input.episodeId, input.pair.target);
    if (!cues || cues.length === 0 || !original) return { outcome: "skipped", lines: 0 };

    const llm = await deps.resolveLlm(input.userId);
    let raw: unknown;
    try {
      raw = await llm.translateLines(
        cues.map((cue) => ({ id: cue.id, text: cue.text })),
        input.pair,
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError("LLM_FAILED");
    }
    const parsed = translatedSongLinesSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("LLM_INVALID_OUTPUT");
    const translated = applyTranslatedLines(
      cues.map((cue) => ({ ...cue })),
      parsed.data,
    );
    if (translated.length === 0) throw new AppError("LLM_INVALID_OUTPUT");

    await deps.subtitles.importSubtitles({
      userId: input.userId,
      episodeId: input.episodeId,
      target: { language: input.pair.target, upload: { filename: "lyrics.srt", bytes: original } },
      native: {
        language: input.pair.native,
        upload: { filename: "translation.srt", bytes: encoder.encode(cuesToSrt(translated)) },
      },
    });
    await deps.music.updateTranslationSource(input.episodeId, "llm");
    return { outcome: "translated", lines: translated.length };
  };
}
