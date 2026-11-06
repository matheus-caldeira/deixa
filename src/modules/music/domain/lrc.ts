export type LrcLine = { timeMs: number; text: string };
export type LrcMetadata = { artist: string | null; title: string | null; album: string | null };
export type ParsedLrc = { metadata: LrcMetadata; lines: LrcLine[] };
export type LyricCue = { sequence: number; startMs: number; endMs: number; text: string };

export const MAX_CUE_MS = 7000;
export const LAST_CUE_MS = 4000;
export const MAX_LYRIC_LINES = 1500;
export const MAX_LYRIC_LINE_CHARS = 300;
export const MAX_LRC_CHARS = 200_000;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const FRACTION_DIGITS = 3;

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const LEADING_TIMESTAMPS = /^(?:\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\])+/;
const METADATA = /^\s*\[([a-z]{2,8}):([^\]]*)\]\s*$/i;
const INLINE_WORD_TIME = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;
const BYTE_ORDER_MARK = "﻿";

function toMs(minutes: string, seconds: string, fraction: string | undefined) {
  return (
    Number(minutes) * MS_PER_MINUTE +
    Number(seconds) * MS_PER_SECOND +
    Number((fraction ?? "").padEnd(FRACTION_DIGITS, "0").slice(0, FRACTION_DIGITS) || 0)
  );
}

function cleanText(raw: string): string {
  return raw.replace(INLINE_WORD_TIME, "").replace(/\s+/g, " ").trim().slice(0, MAX_LYRIC_LINE_CHARS);
}

function readOffset(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function parseLrc(content: string): ParsedLrc {
  const metadata: LrcMetadata = { artist: null, title: null, album: null };
  const lines: LrcLine[] = [];
  let offsetMs = 0;
  const normalized = content.replace(BYTE_ORDER_MARK, "").replace(/\r\n?/g, "\n");
  for (const row of normalized.split("\n")) {
    const lead = row.match(LEADING_TIMESTAMPS);
    if (!lead) {
      const meta = row.match(METADATA);
      const key = meta?.[1]?.toLowerCase();
      const value = (meta?.[2] ?? "").trim();
      if (key === "ar") metadata.artist = value || null;
      else if (key === "ti") metadata.title = value || null;
      else if (key === "al") metadata.album = value || null;
      else if (key === "offset") offsetMs = readOffset(value);
      continue;
    }
    const text = cleanText(row.slice(lead[0].length));
    for (const stamp of lead[0].matchAll(TIMESTAMP)) {
      lines.push({ timeMs: toMs(stamp[1] ?? "0", stamp[2] ?? "0", stamp[3]), text });
    }
  }
  const shifted = lines.map((line) => ({ ...line, timeMs: Math.max(0, line.timeMs - offsetMs) }));
  const ordered = shifted
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.timeMs - b.line.timeMs || a.index - b.index)
    .map((entry) => entry.line);
  return { metadata, lines: ordered.slice(0, MAX_LYRIC_LINES) };
}

export function lrcToCues(
  lines: readonly LrcLine[],
  options: { durationMs?: number | null } = {},
): LyricCue[] {
  const cues: LyricCue[] = [];
  lines.forEach((line, index) => {
    if (line.text.length === 0) return;
    const next = lines.slice(index + 1).find((candidate) => candidate.timeMs > line.timeMs);
    const limit = Math.min(next?.timeMs ?? line.timeMs + LAST_CUE_MS, line.timeMs + MAX_CUE_MS);
    const trackEnd = options.durationMs && options.durationMs > line.timeMs ? options.durationMs : null;
    const endMs = trackEnd && !next ? Math.min(limit, trackEnd) : limit;
    cues.push({
      sequence: cues.length + 1,
      startMs: line.timeMs,
      endMs: Math.max(endMs, line.timeMs + 1),
      text: line.text,
    });
  });
  return cues;
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, "0");
}

export function formatSrtTime(ms: number): string {
  const hours = Math.floor(ms / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(ms % MS_PER_SECOND, 3)}`;
}

export function cuesToSrt(cues: readonly LyricCue[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTime(cue.startMs)} --> ${formatSrtTime(cue.endMs)}\n${cue.text}\n`,
    )
    .join("\n");
}

export function hasTimestamps(content: string): boolean {
  return parseLrc(content).lines.length > 0;
}
