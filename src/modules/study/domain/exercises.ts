import { levelIndex, type CefrLevel } from "@/shared/levels";
import { cleanToken, tokenize } from "@/shared/text";
import type { TrailLine } from "./trail";

type Base = { id: string; cueId: string; startMs: number; translation: string | null };

export type Exercise =
  | (Base & { kind: "intro"; english: string; portuguese: string | null })
  | (Base & { kind: "choice"; prompt: PromptKey; english: string; options: string[]; answer: number })
  | (Base & { kind: "listen"; prompt: PromptKey; english: string; options: string[]; answer: number })
  | (Base & { kind: "order"; prompt: PromptKey; hint: string | null; bank: string[]; solution: string[] })
  | (Base & {
      kind: "blank";
      prompt: PromptKey;
      before: string;
      after: string;
      hint: string | null;
      options: string[];
      answer: number;
    })
  | (Base & { kind: "type"; prompt: PromptKey; hint: string | null; best: string });

export type ExerciseKind = Exercise["kind"];
export type Answer = null | number | number[] | string;
export type LevelBand = "beginner" | "intermediate" | "advanced";
export type LessonChallenge = "easier" | "steady" | "harder";

export const LESSON_SIZE = 6;
export const PASS_ACCURACY = 70;
export const MIN_ORDER_TOKENS = 3;
export const MAX_ORDER_TOKENS = 10;
const MIN_BLANK_WORD_LENGTH = 4;
const CHOICE_OPTIONS = 4;
const LISTEN_OPTIONS = 3;
const BLANK_OPTIONS = 3;
const ORDER_DISTRACTORS = 2;
const LAST_BEGINNER_LEVEL = 1;
const LAST_INTERMEDIATE_LEVEL = 3;
const MAX_TYPED_TOKENS = 13;

const PLANS: Record<LevelBand, ExerciseKind[]> = {
  beginner: ["choice", "listen", "order", "blank", "choice", "listen"],
  intermediate: ["blank", "order", "choice", "type", "listen", "blank"],
  advanced: ["listen", "type", "blank", "order", "type", "listen"],
};

export const PROMPTS = {
  choice: "choice",
  listen: "listen",
  orderFromHint: "orderFromHint",
  orderFromAudio: "orderFromAudio",
  blank: "blank",
  typeFromHint: "typeFromHint",
  dictation: "dictation",
} as const;
export type PromptKey = (typeof PROMPTS)[keyof typeof PROMPTS];

export function levelBand(level: CefrLevel): LevelBand {
  const index = levelIndex(level);
  if (index <= LAST_BEGINNER_LEVEL) return "beginner";
  return index <= LAST_INTERMEDIATE_LEVEL ? "intermediate" : "advanced";
}

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

export function shuffled<Item>(items: readonly Item[], random: () => number): Item[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index] as Item;
    copy[index] = copy[other] as Item;
    copy[other] = held;
  }
  return copy;
}

export function normalizeOption(text: string): string {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/^[\s"“”'¿¡(]+|[\s"“”.,!?;:…)]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?;:"“”…-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function optionsWithAnswer(
  correct: string,
  distractors: readonly string[],
  random: () => number,
  maxOptions = CHOICE_OPTIONS,
): { options: string[]; answer: number } | null {
  const right = normalizeOption(correct);
  const wrong = [...new Set(distractors.map(normalizeOption))]
    .filter((option) => option !== "" && option !== right)
    .slice(0, maxOptions - 1);
  if (right === "" || wrong.length < 2) return null;
  const options = shuffled([right, ...wrong], random);
  return { options, answer: options.indexOf(right) };
}

export function orderTokens(text: string): string[] {
  return tokenize(text)
    .map(normalizeOption)
    .filter((token) => token !== "");
}

function closestInLength(
  pool: readonly string[],
  target: string,
  count: number,
  random: () => number,
): string[] {
  const size = tokenize(target).length;
  const right = normalizeOption(target);
  return shuffled([...new Set(pool)], random)
    .filter((candidate) => normalizeOption(candidate) !== right)
    .sort((a, b) => Math.abs(tokenize(a).length - size) - Math.abs(tokenize(b).length - size))
    .slice(0, count);
}

export function blankParts(text: string, word: string): { before: string; after: string } | null {
  const tokens = tokenize(text);
  const wanted = normalizeOption(word);
  const index = tokens.findIndex((token) => normalizeOption(token) === wanted);
  const original = tokens[index];
  if (index < 0 || !original || wanted === "") return null;
  const cleaned = cleanToken(original);
  const trailing = original.slice(original.indexOf(cleaned) + cleaned.length);
  const rest = tokens.slice(index + 1).join(" ");
  return {
    before: tokens.slice(0, index).join(" "),
    after: `${trailing}${rest ? " " : ""}${rest}`,
  };
}

export function buildExercise(input: {
  kind: ExerciseKind;
  id: string;
  line: TrailLine;
  level: CefrLevel;
  random: () => number;
  translation?: string | null;
  meaningDistractors?: readonly string[];
  listenDistractors?: readonly string[];
  extraWords?: readonly string[];
  blankWord?: string;
  blankDistractors?: readonly string[];
}): Exercise | null {
  const { kind, line, level, random } = input;
  const translation = line.translation ?? input.translation ?? null;
  const base = { id: input.id, cueId: line.cueId, startMs: line.startMs, translation };
  const band = levelBand(level);

  if (kind === "intro") return { ...base, kind, english: line.text, portuguese: translation };

  if (kind === "choice") {
    if (!translation) return null;
    const answered = optionsWithAnswer(translation, input.meaningDistractors ?? [], random);
    return answered ? { ...base, kind, prompt: PROMPTS.choice, english: line.text, ...answered } : null;
  }

  if (kind === "listen") {
    const answered = optionsWithAnswer(line.text, input.listenDistractors ?? [], random, LISTEN_OPTIONS);
    return answered ? { ...base, kind, prompt: PROMPTS.listen, english: line.text, ...answered } : null;
  }

  if (kind === "order") {
    const solution = orderTokens(line.text);
    if (solution.length < MIN_ORDER_TOKENS || solution.length > MAX_ORDER_TOKENS) return null;
    const useAudio = band !== "beginner" || !translation;
    const extra = [...new Set((input.extraWords ?? []).map(normalizeOption))]
      .filter((word) => word !== "" && !word.includes(" ") && !solution.includes(word))
      .slice(0, ORDER_DISTRACTORS);
    return {
      ...base,
      kind,
      prompt: useAudio ? PROMPTS.orderFromAudio : PROMPTS.orderFromHint,
      hint: useAudio ? null : translation,
      bank: shuffled([...solution, ...extra], random),
      solution,
    };
  }

  if (kind === "blank") {
    const word = input.blankWord ?? "";
    const parts = blankParts(line.text, word);
    const answered = optionsWithAnswer(word, input.blankDistractors ?? [], random, BLANK_OPTIONS + 1);
    if (!parts || !answered || tokenize(line.text).length < MIN_ORDER_TOKENS) return null;
    return {
      ...base,
      kind,
      prompt: PROMPTS.blank,
      ...parts,
      hint: band === "advanced" ? null : translation,
      ...answered,
    };
  }

  if (tokenize(line.text).length > MAX_TYPED_TOKENS) return null;
  const dictation = band === "advanced" || !translation;
  return {
    ...base,
    kind: "type",
    prompt: dictation ? PROMPTS.dictation : PROMPTS.typeFromHint,
    hint: dictation ? null : translation,
    best: line.text,
  };
}

function fallbackExercise(
  kind: ExerciseKind,
  line: TrailLine,
  all: readonly TrailLine[],
  level: CefrLevel,
  random: () => number,
  id: string,
): Exercise | null {
  const others = all.filter((candidate) => candidate.cueId !== line.cueId);
  const blankCandidates = tokenize(line.text)
    .map(cleanToken)
    .filter((word) => word.length >= MIN_BLANK_WORD_LENGTH && /^[\p{L}']+$/u.test(word));
  return buildExercise({
    kind,
    id,
    line,
    level,
    random,
    meaningDistractors: shuffled(
      others.flatMap((candidate) => (candidate.translation ? [candidate.translation] : [])),
      random,
    ),
    listenDistractors: closestInLength(
      others.map((candidate) => candidate.text),
      line.text,
      LISTEN_OPTIONS - 1,
      random,
    ),
    extraWords: shuffled(
      others.flatMap((candidate) => orderTokens(candidate.text)),
      random,
    ),
    blankWord: blankCandidates[Math.floor(random() * blankCandidates.length)],
    blankDistractors: shuffled(
      others
        .flatMap((candidate) => tokenize(candidate.text).map(cleanToken))
        .filter((word) => word.length >= MIN_BLANK_WORD_LENGTH),
      random,
    ),
  });
}

export function buildLesson(input: {
  seed: string;
  level: CefrLevel;
  nodeLines: readonly TrailLine[];
  allLines: readonly TrailLine[];
  size?: number;
  idPrefix?: string;
}): Exercise[] {
  const random = createRandom(`${input.seed}:${input.level}`);
  const plan = PLANS[levelBand(input.level)];
  const lines = input.nodeLines;
  if (lines.length === 0) return [];
  const size = input.size ?? LESSON_SIZE;
  const alternatives: ExerciseKind[] = ["listen", "blank", "order", "type", "choice"];
  const exercises: Exercise[] = [];
  for (let slot = 0; slot < size; slot += 1) {
    const line = lines[Math.floor((slot * lines.length) / size) % lines.length] ?? lines[0];
    if (!line) continue;
    const wanted = plan[slot % plan.length] ?? "listen";
    const id = `${input.idPrefix ?? "f"}${slot}`;
    const exercise = [wanted, ...alternatives.filter((kind) => kind !== wanted)]
      .map((kind) => fallbackExercise(kind, line, input.allLines, input.level, random, id))
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

export function isGradable(exercise: Exercise): boolean {
  return exercise.kind !== "intro";
}

export function accuracyOf(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

const XP_PER_CORRECT = 3;
const PERFECT_BONUS = 5;
export const MAX_PAID_REPLAYS_PER_DAY = 2;

export function lessonXp(input: {
  correct: number;
  total: number;
  replay: boolean;
  replaysToday: number;
}): number {
  if (input.total === 0 || accuracyOf(input.correct, input.total) < PASS_ACCURACY) return 0;
  if (input.replay && input.replaysToday >= MAX_PAID_REPLAYS_PER_DAY) return 0;
  const full = input.correct * XP_PER_CORRECT + (input.correct === input.total ? PERFECT_BONUS : 0);
  return input.replay ? Math.round(full / 2) : full;
}

function withShuffledOptions<Item extends { options: string[]; answer: number }>(
  exercise: Item,
  random: () => number,
): Item {
  const order = shuffled(
    exercise.options.map((_, index) => index),
    random,
  );
  return {
    ...exercise,
    options: order.map((index) => exercise.options[index] ?? ""),
    answer: order.indexOf(exercise.answer),
  };
}

function rearranged(exercise: Exercise, random: () => number): Exercise {
  switch (exercise.kind) {
    case "choice":
    case "listen":
    case "blank":
      return withShuffledOptions(exercise, random);
    case "order":
      return { ...exercise, bank: shuffled(exercise.bank, random) };
    default:
      return exercise;
  }
}

function withHint(exercise: Exercise): Exercise {
  const hint = exercise.translation;
  if (!hint) return exercise;
  switch (exercise.kind) {
    case "order":
      return { ...exercise, prompt: PROMPTS.orderFromHint, hint };
    case "blank":
      return { ...exercise, hint };
    case "type":
      return { ...exercise, prompt: PROMPTS.typeFromHint, hint };
    default:
      return exercise;
  }
}

function withoutHint(exercise: Exercise): Exercise {
  switch (exercise.kind) {
    case "order":
      return { ...exercise, prompt: PROMPTS.orderFromAudio, hint: null };
    case "blank":
      return { ...exercise, hint: null };
    case "type":
      return { ...exercise, prompt: PROMPTS.dictation, hint: null };
    default:
      return exercise;
  }
}

export function adaptToChallenge(exercise: Exercise, challenge: LessonChallenge): Exercise {
  if (challenge === "easier") return withHint(exercise);
  if (challenge === "harder") return withoutHint(exercise);
  return exercise;
}

export function arrangeLesson(
  exercises: readonly Exercise[],
  seed: string,
  challenge: LessonChallenge = "steady",
): Exercise[] {
  const random = createRandom(`arrange:${seed}`);
  const intros = exercises.filter((exercise) => exercise.kind === "intro");
  const practice = shuffled(
    exercises.filter((exercise) => exercise.kind !== "intro"),
    random,
  );
  return [...intros, ...practice].map((exercise) =>
    adaptToChallenge(rearranged(exercise, random), challenge),
  );
}
