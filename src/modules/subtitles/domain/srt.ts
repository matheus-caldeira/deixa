import { AppError } from "@/shared/errors";

export type ParsedCue = { sequence: number; startMs: number; endMs: number; text: string };
export type SubtitleLanguage = "en" | "pt-BR";

export const MAX_SUBTITLE_BYTES = 5_000_000;
export const SCENE_GAP_MS = 15_000;
export const SUBTITLE_PROCESSING_VERSION = 1;

const TIME_LINE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const FORMATTING_TAGS = /<\/?[a-z][^>]*>|\{\\[^}]*\}/gi;
const BYTE_ORDER_MARK = "﻿";

function toMs(hours: string, minutes: string, seconds: string, fraction: string): number {
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1000 +
    Number(fraction.padEnd(3, "0"))
  );
}

export function parseSrt(content: string): { cues: ParsedCue[]; skippedBlocks: number } {
  const normalized = content.replace(BYTE_ORDER_MARK, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  const cues: ParsedCue[] = [];
  let skippedBlocks = 0;
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim());
    const timeIndex = lines.findIndex((line) => TIME_LINE.test(line));
    const match = timeIndex >= 0 ? lines[timeIndex]?.match(TIME_LINE) : null;
    if (!match) {
      skippedBlocks += 1;
      continue;
    }
    const startMs = toMs(match[1] ?? "0", match[2] ?? "0", match[3] ?? "0", match[4] ?? "0");
    const endMs = toMs(match[5] ?? "0", match[6] ?? "0", match[7] ?? "0", match[8] ?? "0");
    const text = lines
      .slice(timeIndex + 1)
      .join(" ")
      .replace(FORMATTING_TAGS, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length === 0 || endMs <= startMs) {
      skippedBlocks += 1;
      continue;
    }
    cues.push({ sequence: cues.length + 1, startMs, endMs, text });
  }
  return { cues, skippedBlocks };
}

export function decodeSubtitle(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function validateSubtitleFile(file: { filename: string; bytes: Uint8Array }): void {
  if (!/\.srt$/i.test(file.filename)) {
    throw new AppError("SUBTITLE_INVALID", "Envie um arquivo .srt. Outros formatos ainda não são aceitos.");
  }
  if (file.bytes.byteLength === 0) throw new AppError("SUBTITLE_INVALID", "O arquivo está vazio.");
  if (file.bytes.byteLength > MAX_SUBTITLE_BYTES) {
    throw new AppError("SUBTITLE_INVALID", "Arquivo maior que 5 MB. Confira se é o arquivo certo.");
  }
}

export function sceneIndexes(
  cues: readonly { startMs: number; endMs: number }[],
  gapMs = SCENE_GAP_MS,
): number[] {
  let scene = 0;
  return cues.map((cue, index) => {
    const previous = cues[index - 1];
    if (previous && cue.startMs - previous.endMs > gapMs) scene += 1;
    return scene;
  });
}

export function formatFileSize(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
