import { CEFR_LEVELS, type CefrLevel } from "@/shared/levels";
import type { StudyLanguage } from "@/shared/study-languages";
import { aggregateLevelRanges, type LevelRange } from "./level-ratings";

export type MeasurableCue = { startMs: number; endMs: number; text: string };

export type SubtitleLevelMetrics = {
  words: number;
  wordsPerMinute: number;
  meanSentenceWords: number;
  lexicalDiversity: number;
  longWordRatio: number;
};

export type SubtitleLevelMeasurement = SubtitleLevelMetrics & { score: number; level: CefrLevel };

export const MIN_MEASURED_WORDS = 150;
export const DIVERSITY_WINDOW = 50;
const MS_PER_MINUTE = 60_000;
const MAX_SCORE = CEFR_LEVELS.length - 1;
const SCORE_DECIMALS = 100;

const LONG_WORD_LETTERS: Record<StudyLanguage, number> = { en: 7, "pt-BR": 8, es: 8, fr: 8 };

type Anchor = { easy: number; hard: number; weight: number };

const ANCHORS: Record<keyof Omit<SubtitleLevelMetrics, "words">, Anchor> = {
  wordsPerMinute: { easy: 90, hard: 200, weight: 0.3 },
  meanSentenceWords: { easy: 4, hard: 14, weight: 0.25 },
  lexicalDiversity: { easy: 0.65, hard: 0.92, weight: 0.2 },
  longWordRatio: { easy: 0.06, hard: 0.26, weight: 0.25 },
};

const MARKUP = /<[^>]*>|\{[^}]*\}|\[[^\]]*\]|\([^)]*\)|♪/g;
const SPEAKER_LABEL = /^\s*[\p{Lu}][\p{Lu}\s.'-]*:\s*/u;
const LEADING_DASH = /^\s*[-–—]\s*/;
const WORD = /\p{L}+(?:['’]\p{L}+)*/gu;
const SENTENCE_END = /[.!?…]+/;

export function cleanCueText(text: string): string {
  return text
    .replace(MARKUP, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_DASH, "").replace(SPEAKER_LABEL, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const wordsOf = (text: string): string[] => text.toLocaleLowerCase().match(WORD) ?? [];

function movingTypeTokenRatio(tokens: readonly string[]): number {
  if (tokens.length <= DIVERSITY_WINDOW) return new Set(tokens).size / Math.max(tokens.length, 1);
  let total = 0;
  const windows = tokens.length - DIVERSITY_WINDOW + 1;
  for (let start = 0; start < windows; start += 1) {
    total += new Set(tokens.slice(start, start + DIVERSITY_WINDOW)).size / DIVERSITY_WINDOW;
  }
  return total / windows;
}

function scaled(value: number, anchor: Anchor): number {
  const position = (value - anchor.easy) / (anchor.hard - anchor.easy);
  return Math.min(Math.max(position, 0), 1) * MAX_SCORE;
}

const round = (value: number) => Math.round(value * SCORE_DECIMALS) / SCORE_DECIMALS;

export function measureSubtitleLevel(
  cues: readonly MeasurableCue[],
  language: StudyLanguage,
): SubtitleLevelMeasurement | null {
  const ordered = [...cues].sort((left, right) => left.startMs - right.startMs);
  const tokens: string[] = [];
  const texts: string[] = [];
  let spokenMs = 0;
  for (const cue of ordered) {
    const text = cleanCueText(cue.text);
    const words = wordsOf(text);
    if (words.length === 0 || cue.endMs <= cue.startMs) continue;
    tokens.push(...words);
    texts.push(text);
    spokenMs += cue.endMs - cue.startMs;
  }
  if (tokens.length < MIN_MEASURED_WORDS) return null;
  const sentences = texts
    .join(" ")
    .split(SENTENCE_END)
    .map((sentence) => wordsOf(sentence).length)
    .filter((count) => count > 0);
  const longLetters = LONG_WORD_LETTERS[language];
  const metrics = {
    wordsPerMinute: tokens.length / (spokenMs / MS_PER_MINUTE),
    meanSentenceWords: tokens.length / Math.max(sentences.length, 1),
    lexicalDiversity: movingTypeTokenRatio(tokens),
    longWordRatio:
      tokens.filter((word) => word.replace(/['’]/g, "").length >= longLetters).length / tokens.length,
  };
  const score = (Object.keys(ANCHORS) as (keyof typeof ANCHORS)[]).reduce(
    (sum, key) => sum + scaled(metrics[key], ANCHORS[key]) * ANCHORS[key].weight,
    0,
  );
  const level = CEFR_LEVELS[Math.min(Math.round(score), MAX_SCORE)] ?? "A1";
  return {
    words: tokens.length,
    wordsPerMinute: round(metrics.wordsPerMinute),
    meanSentenceWords: round(metrics.meanSentenceWords),
    lexicalDiversity: round(metrics.lexicalDiversity),
    longWordRatio: round(metrics.longWordRatio),
    score: round(score),
    level,
  };
}

export function aggregateMeasuredLevels(levels: readonly CefrLevel[]): LevelRange | null {
  return aggregateLevelRanges(levels.map((level): LevelRange => [level, level]));
}
