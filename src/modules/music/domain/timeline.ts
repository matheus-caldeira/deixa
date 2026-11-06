import { z } from "zod";
import { AppError } from "@/shared/errors";

export const MAX_LEAD_IN_MS = 600_000;
export const MAX_PAUSES = 20;
export const MAX_PAUSE_MS = 600_000;
export const MAX_LYRICS_MS = 7_200_000;
const VIDEO_ID_LENGTH = 11;

export const pauseSchema = z.object({
  atMs: z.number().int().min(0).max(MAX_LYRICS_MS),
  durationMs: z.number().int().min(1).max(MAX_PAUSE_MS),
});
export type SongPause = z.infer<typeof pauseSchema>;

export const songTimingSchema = z.object({
  leadInMs: z.number().int().min(0).max(MAX_LEAD_IN_MS),
  pauses: z.array(pauseSchema).max(MAX_PAUSES),
});
export type SongTiming = z.infer<typeof songTimingSchema>;

export const youtubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

export function normalizePauses(pauses: readonly SongPause[]): SongPause[] {
  return [...pauses].sort((a, b) => a.atMs - b.atMs);
}

export function lyricsToVideoMs(lyricsMs: number, timing: SongTiming): number {
  const paused = normalizePauses(timing.pauses)
    .filter((pause) => pause.atMs <= lyricsMs)
    .reduce((total, pause) => total + pause.durationMs, 0);
  return timing.leadInMs + lyricsMs + paused;
}

export function videoToLyricsMs(videoMs: number, timing: SongTiming): number {
  let accumulated = 0;
  for (const pause of normalizePauses(timing.pauses)) {
    const pauseStart = timing.leadInMs + pause.atMs + accumulated;
    if (videoMs < pauseStart) break;
    if (videoMs < pauseStart + pause.durationMs) return pause.atMs;
    accumulated += pause.durationMs;
  }
  return Math.max(0, videoMs - timing.leadInMs - accumulated);
}

export function activeCueIndex(cues: readonly { startMs: number }[], lyricsMs: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((cues[middle]?.startMs ?? Infinity) <= lyricsMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

const VIDEO_ID = new RegExp(`^[A-Za-z0-9_-]{${VIDEO_ID_LENGTH}}$`);
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const PATH_PREFIXES = new Set(["shorts", "embed", "live", "v"]);

function validId(value: string | null | undefined): string | null {
  return value && VIDEO_ID.test(value) ? value : null;
}

export function findYoutubeVideoId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be") return validId(segments[0]);
  if (!YOUTUBE_HOSTS.has(host)) return null;
  if (segments[0] === "watch") return validId(url.searchParams.get("v"));
  if (segments[0] && PATH_PREFIXES.has(segments[0])) return validId(segments[1]);
  return null;
}

export function parseYoutubeVideoId(input: string): string {
  const id = findYoutubeVideoId(input);
  if (!id) throw new AppError("MUSIC_INVALID_VIDEO");
  return id;
}
