import { AppError } from "@/shared/errors";

export const MAX_SCRIPT_BYTES = 2_000_000;
const MAX_SCRIPT_MB = 2;
export const MAX_SCRIPT_LINES = 20_000;
export const SCRIPT_MATCH_THRESHOLD = 0.6;
export const SCRIPT_VERIFIED_RATE = 0.5;
export const SCRIPT_SEARCH_WINDOW = 40;
const MIN_TOKENS_FOR_PARTIAL_MATCH = 2;
const MIN_EXTRA_TOKENS_FOR_COMPLETION = 2;

const SPEAKER_PREFIX = /^(?:[A-Z][A-Z0-9 .'\-]{0,30}|[A-Z][a-z]+(?: [A-Z][a-z]+)?)\s*:\s*/;
const STAGE_DIRECTION = /\[[^\]]*\]|\([^)]*\)/g;
const SCENE_HEADING = /^(?:INT\.|EXT\.|INT\/EXT\.|CUT TO|FADE (?:IN|OUT))/;
const MUSIC_LINE = /^[♪♫]/;

export type ScriptStatus = "VERIFIED" | "NEEDS_REVIEW";

export type MatchedLine = { sequence: number; text: string; matchedCueId: string | null; verified: boolean };

export type ScriptMatch = {
  lines: MatchedLine[];
  matchedCues: number;
  rate: number;
  status: ScriptStatus;
};

export function validateScriptFile(file: { filename: string; bytes: Uint8Array }): void {
  if (!/\.txt$/i.test(file.filename)) throw new AppError("SCRIPT_INVALID", "onlyTxt");
  if (file.bytes.byteLength === 0) throw new AppError("SCRIPT_INVALID", "emptyFile");
  if (file.bytes.byteLength > MAX_SCRIPT_BYTES) {
    throw new AppError("SCRIPT_INVALID", { key: "tooLarge", params: { mb: MAX_SCRIPT_MB } });
  }
}

export function parseScriptText(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const cleaned = raw.replace(STAGE_DIRECTION, " ").replace(SPEAKER_PREFIX, "").replace(/\s+/g, " ").trim();
    if (cleaned.length === 0) continue;
    if (SCENE_HEADING.test(cleaned) || MUSIC_LINE.test(cleaned)) continue;
    lines.push(cleaned);
    if (lines.length >= MAX_SCRIPT_LINES) break;
  }
  return lines;
}

export function scriptTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token.length > 0);
}

function coverage(cueTokens: readonly string[], lineTokens: readonly string[]): number {
  if (cueTokens.length === 0) return 0;
  const available = new Map<string, number>();
  for (const token of lineTokens) available.set(token, (available.get(token) ?? 0) + 1);
  let found = 0;
  for (const token of cueTokens) {
    const left = available.get(token) ?? 0;
    if (left > 0) {
      found += 1;
      available.set(token, left - 1);
    }
  }
  return found / cueTokens.length;
}

export function matchScriptToCues(
  scriptLines: readonly string[],
  cues: readonly { id: string; text: string }[],
  options: { threshold?: number; window?: number } = {},
): ScriptMatch {
  const threshold = options.threshold ?? SCRIPT_MATCH_THRESHOLD;
  const window = options.window ?? SCRIPT_SEARCH_WINDOW;
  const lineTokens = scriptLines.map(scriptTokens);
  const matchedCueByLine = new Map<number, string>();
  let cursor = 0;
  let matchedCues = 0;
  for (const cue of cues) {
    const tokens = scriptTokens(cue.text);
    if (tokens.length === 0) continue;
    let bestIndex = -1;
    let bestScore = 0;
    const end = Math.min(scriptLines.length, cursor + window);
    for (let index = cursor; index < end; index += 1) {
      const score = coverage(tokens, lineTokens[index] ?? []);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const exact = bestScore === 1 && tokens.length === (lineTokens[bestIndex]?.length ?? -1);
    const accepted =
      bestIndex >= 0 && bestScore >= threshold && (tokens.length >= MIN_TOKENS_FOR_PARTIAL_MATCH || exact);
    if (!accepted) continue;
    matchedCues += 1;
    if (!matchedCueByLine.has(bestIndex)) matchedCueByLine.set(bestIndex, cue.id);
    cursor = bestIndex;
  }
  const rate = cues.length === 0 ? 0 : matchedCues / cues.length;
  return {
    lines: scriptLines.map((text, index) => ({
      sequence: index + 1,
      text,
      matchedCueId: matchedCueByLine.get(index) ?? null,
      verified: matchedCueByLine.has(index),
    })),
    matchedCues,
    rate,
    status: rate >= SCRIPT_VERIFIED_RATE ? "VERIFIED" : "NEEDS_REVIEW",
  };
}

export function completesCue(cueText: string, lineText: string): boolean {
  const cueTokens = scriptTokens(cueText);
  const lineTokens = scriptTokens(lineText);
  return lineTokens.length - cueTokens.length >= MIN_EXTRA_TOKENS_FOR_COMPLETION;
}
