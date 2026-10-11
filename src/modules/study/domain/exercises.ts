import { levelIndex, type CefrLevel } from "@/shared/levels";
import { cleanToken, tokenize } from "@/shared/text";
import type { TrailLine } from "./trail";

type Base = { id: string; cueId: string; startMs: number };

export type Exercise =
  | (Base & { kind: "intro"; english: string; portuguese: string | null })
  | (Base & { kind: "choice"; prompt: string; english: string; options: string[]; answer: number })
  | (Base & { kind: "listen"; prompt: string; english: string; options: string[]; answer: number })
  | (Base & { kind: "order"; prompt: string; hint: string | null; bank: string[]; solution: string[] })
  | (Base & {
      kind: "blank";
      prompt: string;
      before: string;
      after: string;
      hint: string | null;
      options: string[];
      answer: number;
    })
  | (Base & { kind: "type"; prompt: string; hint: string | null; best: string });

export type ExerciseKind = Exercise["kind"];
export type Answer = null | number | number[] | string;

export const LESSON_SIZE = 6;
const MIN_ORDER_TOKENS = 3;
const MAX_ORDER_TOKENS = 9;
const MIN_BLANK_WORD_LENGTH = 4;
const CHOICE_OPTIONS = 4;
const LISTEN_OPTIONS = 3;
const BLANK_OPTIONS = 3;
const ORDER_DISTRACTORS = 2;
const LAST_BEGINNER_LEVEL = 1;
const LAST_INTERMEDIATE_LEVEL = 3;

const PLANS: Record<"beginner" | "intermediate" | "advanced", ExerciseKind[]> = {
  beginner: ["intro", "choice", "listen", "order", "blank", "choice"],
  intermediate: ["intro", "blank", "order", "choice", "type", "listen"],
  advanced: ["intro", "listen", "type", "blank", "order", "type"],
};

export function createRandom(seedText: string): () => number {
  let state = 2166136261;
  for (const char of seedText) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<Item>(items: readonly Item[], random: () => number): Item[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index] as Item;
    copy[index] = copy[other] as Item;
    copy[other] = held;
  }
  return copy;
}

function pickDistinct(
  pool: readonly string[],
  exclude: string,
  count: number,
  random: () => number,
): string[] {
  const unique = [...new Set(pool)].filter((value) => value !== exclude && value.trim() !== "");
  return shuffled(unique, random).slice(0, count);
}

function withAnswer(correct: string, distractors: string[], random: () => number) {
  const options = shuffled([correct, ...distractors], random);
  return { options, answer: options.indexOf(correct) };
}

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?;:"“”…-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function planFor(level: CefrLevel): ExerciseKind[] {
  const index = levelIndex(level);
  if (index <= LAST_BEGINNER_LEVEL) return PLANS.beginner;
  if (index <= LAST_INTERMEDIATE_LEVEL) return PLANS.intermediate;
  return PLANS.advanced;
}

function build(
  kind: ExerciseKind,
  line: TrailLine,
  all: readonly TrailLine[],
  level: CefrLevel,
  random: () => number,
  id: string,
): Exercise | null {
  const base = { id, cueId: line.cueId, startMs: line.startMs };
  const tokens = tokenize(line.text);
  const advanced = levelIndex(level) > LAST_INTERMEDIATE_LEVEL;
  const others = all.filter((candidate) => candidate.cueId !== line.cueId);

  if (kind === "intro") return { ...base, kind, english: line.text, portuguese: line.translation };

  if (kind === "choice") {
    if (!line.translation) return null;
    const distractors = pickDistinct(
      others.flatMap((candidate) => (candidate.translation ? [candidate.translation] : [])),
      line.translation,
      CHOICE_OPTIONS - 1,
      random,
    );
    if (distractors.length < 2) return null;
    return {
      ...base,
      kind,
      prompt: "O que significa esta fala?",
      english: line.text,
      ...withAnswer(line.translation, distractors, random),
    };
  }

  if (kind === "listen") {
    const distractors = pickDistinct(
      others.map((candidate) => candidate.text),
      line.text,
      LISTEN_OPTIONS - 1,
      random,
    );
    if (distractors.length < 2) return null;
    return {
      ...base,
      kind,
      prompt: "Toque para ouvir e escolha o que foi dito",
      english: line.text,
      ...withAnswer(line.text, distractors, random),
    };
  }

  if (kind === "order") {
    if (tokens.length < MIN_ORDER_TOKENS || tokens.length > MAX_ORDER_TOKENS) return null;
    const useAudio = advanced || !line.translation || levelIndex(level) > LAST_BEGINNER_LEVEL;
    const extra = pickDistinct(
      others.flatMap((candidate) => tokenize(candidate.text)),
      "",
      ORDER_DISTRACTORS,
      random,
    ).filter((token) => !tokens.includes(token));
    return {
      ...base,
      kind,
      prompt: useAudio ? "Ouça e monte o que foi dito" : "Monte a frase em inglês",
      hint: useAudio ? null : line.translation,
      bank: shuffled([...tokens, ...extra], random),
      solution: tokens,
    };
  }

  if (kind === "blank") {
    const candidates = tokens
      .map((token, index) => ({ index, word: cleanToken(token) }))
      .filter(({ word }) => word.length >= MIN_BLANK_WORD_LENGTH && /^[\p{L}']+$/u.test(word));
    if (candidates.length === 0 || tokens.length < MIN_ORDER_TOKENS) return null;
    const target = candidates[Math.floor(random() * candidates.length)];
    if (!target) return null;
    const distractors = pickDistinct(
      others
        .flatMap((candidate) => tokenize(candidate.text).map(cleanToken))
        .filter((word) => word.length >= MIN_BLANK_WORD_LENGTH),
      target.word,
      BLANK_OPTIONS - 1,
      random,
    ).filter((word) => word.toLowerCase() !== target.word.toLowerCase());
    if (distractors.length < 2) return null;
    const original = tokens[target.index] ?? "";
    const trailing = original.slice(original.indexOf(target.word) + target.word.length);
    return {
      ...base,
      kind,
      prompt: "Complete a frase",
      before: tokens.slice(0, target.index).join(" "),
      after: `${trailing}${target.index < tokens.length - 1 ? " " : ""}${tokens.slice(target.index + 1).join(" ")}`,
      hint: advanced ? null : line.translation,
      ...withAnswer(target.word, distractors, random),
    };
  }

  if (tokens.length > MAX_ORDER_TOKENS + 3) return null;
  const dictation = advanced || !line.translation;
  return {
    ...base,
    kind: "type",
    prompt: dictation ? "Ditado: ouça e escreva exatamente" : "Escreva em inglês",
    hint: dictation ? null : line.translation,
    best: line.text,
  };
}

export function buildLesson(input: {
  seed: string;
  level: CefrLevel;
  nodeLines: readonly TrailLine[];
  allLines: readonly TrailLine[];
}): Exercise[] {
  const random = createRandom(`${input.seed}:${input.level}`);
  const plan = planFor(input.level);
  const lines = input.nodeLines;
  if (lines.length === 0) return [];
  const fallbacks: ExerciseKind[] = ["listen", "blank", "order", "type", "choice", "intro"];
  const exercises: Exercise[] = [];
  for (let slot = 0; slot < Math.min(LESSON_SIZE, Math.max(lines.length, 3)); slot += 1) {
    const line = lines[Math.floor((slot * lines.length) / LESSON_SIZE) % lines.length] ?? lines[0];
    if (!line) continue;
    const wanted = plan[slot] ?? "listen";
    const id = `${slot}`;
    const exercise = [wanted, ...fallbacks.filter((kind) => kind !== wanted)]
      .map((kind) => build(kind, line, input.allLines, input.level, random, id))
      .find((candidate) => candidate !== null);
    if (exercise) exercises.push(exercise);
  }
  return exercises;
}

export function gradeAnswer(exercise: Exercise, answer: Answer): boolean {
  switch (exercise.kind) {
    case "intro":
      return true;
    case "choice":
    case "listen":
    case "blank":
      return answer === exercise.answer;
    case "order":
      return (
        Array.isArray(answer) &&
        normalizeAnswer(answer.map((index) => exercise.bank[index] ?? "").join(" ")) ===
          normalizeAnswer(exercise.solution.join(" "))
      );
    case "type":
      return typeof answer === "string" && normalizeAnswer(answer) === normalizeAnswer(exercise.best);
  }
}

export function correctAnswerText(exercise: Exercise): string {
  switch (exercise.kind) {
    case "intro":
      return exercise.english;
    case "choice":
    case "listen":
      return exercise.options[exercise.answer] ?? "";
    case "blank":
      return `${exercise.before} ${exercise.options[exercise.answer] ?? ""}${exercise.after}`.trim();
    case "order":
      return exercise.solution.join(" ");
    case "type":
      return exercise.best;
  }
}

const BASE_XP = 10;
const XP_PER_CORRECT = 3;
const PERFECT_BONUS = 5;
export const MAX_PAID_REPLAYS_PER_DAY = 2;

export function lessonXp(input: {
  correct: number;
  total: number;
  replay: boolean;
  replaysToday: number;
}): number {
  if (input.total === 0) return 0;
  if (input.replay && input.replaysToday >= MAX_PAID_REPLAYS_PER_DAY) return 0;
  const full = BASE_XP + input.correct * XP_PER_CORRECT + (input.correct === input.total ? PERFECT_BONUS : 0);
  return input.replay ? Math.round(full / 2) : full;
}
