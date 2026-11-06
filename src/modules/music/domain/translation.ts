import { z } from "zod";
import { AppError } from "@/shared/errors";
import { MAX_LYRIC_LINE_CHARS, hasTimestamps, parseLrc, type LyricCue } from "./lrc";

export const MAX_TRANSLATION_GAP_MS = 2000;

export const translatedSongLinesSchema = z
  .array(z.object({ id: z.string().min(1), translation: z.string().trim().min(1).max(MAX_LYRIC_LINE_CHARS) }))
  .max(2000);

function cleanLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_LYRIC_LINE_CHARS);
}

function nearestByTime(source: readonly { timeMs: number; text: string }[], startMs: number): string | null {
  let best: { text: string; gap: number } | null = null;
  for (const line of source) {
    const gap = Math.abs(line.timeMs - startMs);
    if (gap <= MAX_TRANSLATION_GAP_MS && (!best || gap < best.gap)) best = { text: line.text, gap };
  }
  return best?.text ?? null;
}

export function alignPastedTranslation(content: string, cues: readonly LyricCue[]): LyricCue[] {
  if (hasTimestamps(content)) {
    const timed = parseLrc(content).lines.filter((line) => line.text.length > 0);
    const matched = cues.flatMap((cue) => {
      const text = nearestByTime(timed, cue.startMs);
      return text ? [{ ...cue, text }] : [];
    });
    if (matched.length === 0) throw new AppError("MUSIC_TRANSLATION_MISMATCH");
    return matched.map((cue, index) => ({ ...cue, sequence: index + 1 }));
  }
  const lines = content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter((line) => line.length > 0);
  if (lines.length !== cues.length) throw new AppError("MUSIC_TRANSLATION_MISMATCH");
  return cues.map((cue, index) => ({ ...cue, text: lines[index] ?? cue.text }));
}

export function applyTranslatedLines(
  cues: readonly (LyricCue & { id: string })[],
  translated: readonly { id: string; translation: string }[],
): LyricCue[] {
  const byId = new Map(translated.map((entry) => [entry.id, entry.translation]));
  const kept = cues.flatMap((cue) => {
    const text = byId.get(cue.id);
    return text ? [{ sequence: 0, startMs: cue.startMs, endMs: cue.endMs, text }] : [];
  });
  return kept.map((cue, index) => ({ ...cue, sequence: index + 1 }));
}
