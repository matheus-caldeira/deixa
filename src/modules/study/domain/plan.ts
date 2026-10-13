import { z } from "zod";
import { cleanLlmText } from "@/shared/llm-text";
import type { CefrLevel } from "@/shared/levels";
import {
  buildExercise,
  buildLesson,
  createRandom,
  isGradable,
  type Exercise,
  type ExerciseKind,
} from "./exercises";
import { buildTrail, type TrailLine } from "./trail";

export const PLAN_VERSION = 1;
export const MAX_BLOCK_EXERCISES = 8;
export const FINAL_EXERCISES = 10;
const MIN_BLOCK_EXERCISES = 3;
const MIN_FINAL_EXERCISES = 6;
const MAX_BLOCKS = 12;
const MAX_TITLE = 48;
const MAX_SENTENCE = 200;
const MAX_WORD = 30;
const FINAL_TITLE = "Desafio final";

export type PlanProvider = string;

export type PlanBlock = {
  index: number;
  title: string;
  startLine: number;
  endLine: number;
  startMs: number;
  isFinal: boolean;
  exercises: Exercise[];
};

export type LessonPlan = { version: number; level: CefrLevel; provider: PlanProvider; blocks: PlanBlock[] };

const lineIndex = z.number().int().min(0);
const rawExerciseSchema = z.object({
  kind: z.enum(["meaning", "listen", "order", "blank", "type"]),
  line: lineIndex,
  translation: z.unknown().optional(),
  distractors: z.array(z.unknown()).max(6).optional(),
  extraWords: z.array(z.unknown()).max(6).optional(),
  word: z.unknown().optional(),
});

const rawPlanSchema = z.object({
  blocks: z
    .array(
      z.object({
        title: z.unknown(),
        startLine: lineIndex,
        endLine: lineIndex,
        exercises: z.array(z.unknown()).max(40).default([]),
      }),
    )
    .min(1)
    .max(MAX_BLOCKS),
  finalExercises: z.array(z.unknown()).max(40).default([]),
});

const KIND_BY_RAW: Record<z.infer<typeof rawExerciseSchema>["kind"], ExerciseKind> = {
  meaning: "choice",
  listen: "listen",
  order: "order",
  blank: "blank",
  type: "type",
};

const texts = (values: readonly unknown[] | undefined, maxLength: number): string[] =>
  (values ?? []).flatMap((value) => {
    const cleaned = cleanLlmText(value, maxLength);
    return cleaned ? [cleaned] : [];
  });

function convert(
  raw: unknown,
  lines: readonly TrailLine[],
  level: CefrLevel,
  random: () => number,
  id: string,
): { exercise: Exercise; line: number } | null {
  const parsed = rawExerciseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const line = lines[parsed.data.line];
  if (!line) return null;
  const distractors = texts(parsed.data.distractors, MAX_SENTENCE);
  const exercise = buildExercise({
    kind: KIND_BY_RAW[parsed.data.kind],
    id,
    line,
    level,
    random,
    translation: cleanLlmText(parsed.data.translation, MAX_SENTENCE),
    meaningDistractors: distractors,
    listenDistractors: distractors,
    extraWords: texts(parsed.data.extraWords, MAX_WORD),
    blankWord: cleanLlmText(parsed.data.word, MAX_WORD) ?? undefined,
    blankDistractors: distractors,
  });
  return exercise ? { exercise, line: parsed.data.line } : null;
}

type Boundary = { title: string; startLine: number; endLine: number };

function fallbackBoundaries(lines: readonly TrailLine[]): Boundary[] {
  const nodes = buildTrail(lines);
  const regular = nodes.length > 1 ? nodes : nodes;
  let cursor = 0;
  return regular.map((node, index) => {
    const startLine = cursor;
    cursor += node.lines.length;
    return { title: `Cena ${index + 1}`, startLine, endLine: cursor - 1 };
  });
}

function validBoundaries(raw: z.infer<typeof rawPlanSchema>, lineCount: number): Boundary[] | null {
  const sorted = [...raw.blocks].sort((a, b) => a.startLine - b.startLine);
  let expected = 0;
  const boundaries: Boundary[] = [];
  for (const [index, block] of sorted.entries()) {
    if (block.startLine !== expected || block.endLine < block.startLine || block.endLine >= lineCount)
      return null;
    boundaries.push({
      title: cleanLlmText(block.title, MAX_TITLE) ?? `Bloco ${index + 1}`,
      startLine: block.startLine,
      endLine: block.endLine,
    });
    expected = block.endLine + 1;
  }
  return expected === lineCount ? boundaries : null;
}

function completeWithFallback(input: {
  exercises: Exercise[];
  minimum: number;
  target: number;
  seed: string;
  level: CefrLevel;
  nodeLines: readonly TrailLine[];
  allLines: readonly TrailLine[];
}): Exercise[] {
  if (input.exercises.length >= input.minimum) return input.exercises.slice(0, input.target);
  const extras = buildLesson({
    seed: input.seed,
    level: input.level,
    nodeLines: input.nodeLines,
    allLines: input.allLines,
    size: input.target - input.exercises.length,
    idPrefix: `${input.seed}-x`,
  });
  return [...input.exercises, ...extras].slice(0, input.target);
}

function withIntro(
  block: Boundary,
  lines: readonly TrailLine[],
  level: CefrLevel,
  id: string,
  rest: Exercise[],
): Exercise[] {
  const first = lines[block.startLine];
  const known = rest.find((exercise) => exercise.cueId === first?.cueId)?.translation ?? null;
  const intro = first
    ? buildExercise({ kind: "intro", id, line: first, level, random: () => 0, translation: known })
    : null;
  return intro ? [intro, ...rest] : rest;
}

export function assemblePlan(input: {
  raw: unknown;
  lines: readonly TrailLine[];
  level: CefrLevel;
  seed: string;
  provider: PlanProvider;
}): LessonPlan | null {
  const { lines, level, seed } = input;
  if (lines.length === 0) return null;
  const parsed = rawPlanSchema.safeParse(input.raw);
  if (!parsed.success) return null;
  const boundaries = validBoundaries(parsed.data, lines.length) ?? fallbackBoundaries(lines);
  const random = createRandom(`${seed}:${level}`);

  const converted = parsed.data.blocks
    .flatMap((block) => block.exercises)
    .flatMap((raw, index) => {
      const result = convert(raw, lines, level, random, `a${index}`);
      return result ? [result] : [];
    });

  const blocks: PlanBlock[] = boundaries.map((boundary, index) => {
    const own = converted
      .filter((entry) => entry.line >= boundary.startLine && entry.line <= boundary.endLine)
      .map((entry) => entry.exercise);
    const exercises = completeWithFallback({
      exercises: own,
      minimum: MIN_BLOCK_EXERCISES,
      target: Math.max(
        MIN_BLOCK_EXERCISES,
        Math.min(MAX_BLOCK_EXERCISES, own.length || LESSON_FALLBACK_SIZE),
      ),
      seed: `${seed}:b${index}`,
      level,
      nodeLines: lines.slice(boundary.startLine, boundary.endLine + 1),
      allLines: lines,
    });
    return {
      index,
      title: boundary.title,
      startLine: boundary.startLine,
      endLine: boundary.endLine,
      startMs: lines[boundary.startLine]?.startMs ?? 0,
      isFinal: false,
      exercises: withIntro(boundary, lines, level, `i${index}`, exercises),
    };
  });

  const finalOwn = parsed.data.finalExercises.flatMap((raw, index) => {
    const result = convert(raw, lines, level, random, `z${index}`);
    return result ? [result.exercise] : [];
  });
  blocks.push({
    index: blocks.length,
    title: FINAL_TITLE,
    startLine: 0,
    endLine: lines.length - 1,
    startMs: lines[lines.length - 1]?.startMs ?? 0,
    isFinal: true,
    exercises: completeWithFallback({
      exercises: finalOwn,
      minimum: MIN_FINAL_EXERCISES,
      target: FINAL_EXERCISES,
      seed: `${seed}:final`,
      level,
      nodeLines: lines,
      allLines: lines,
    }),
  });

  return { version: PLAN_VERSION, level, provider: input.provider, blocks };
}

const LESSON_FALLBACK_SIZE = 6;

export function fallbackPlan(lines: readonly TrailLine[], level: CefrLevel, seed: string): LessonPlan | null {
  const boundaries = fallbackBoundaries(lines);
  return assemblePlan({
    raw: { blocks: boundaries.map((boundary) => ({ ...boundary, exercises: [] })), finalExercises: [] },
    lines,
    level,
    seed,
    provider: "fallback",
  });
}

export function gradableCount(block: PlanBlock): number {
  return block.exercises.filter(isGradable).length;
}

const exerciseBase = {
  id: z.string(),
  cueId: z.string(),
  startMs: z.number(),
  translation: z.string().nullable(),
};
const storedExerciseSchema = z.discriminatedUnion("kind", [
  z.object({
    ...exerciseBase,
    kind: z.literal("intro"),
    english: z.string(),
    portuguese: z.string().nullable(),
  }),
  z.object({
    ...exerciseBase,
    kind: z.literal("choice"),
    prompt: z.string(),
    english: z.string(),
    options: z.array(z.string()),
    answer: z.number(),
  }),
  z.object({
    ...exerciseBase,
    kind: z.literal("listen"),
    prompt: z.string(),
    english: z.string(),
    options: z.array(z.string()),
    answer: z.number(),
  }),
  z.object({
    ...exerciseBase,
    kind: z.literal("order"),
    prompt: z.string(),
    hint: z.string().nullable(),
    bank: z.array(z.string()),
    solution: z.array(z.string()),
  }),
  z.object({
    ...exerciseBase,
    kind: z.literal("blank"),
    prompt: z.string(),
    before: z.string(),
    after: z.string(),
    hint: z.string().nullable(),
    options: z.array(z.string()),
    answer: z.number(),
  }),
  z.object({
    ...exerciseBase,
    kind: z.literal("type"),
    prompt: z.string(),
    hint: z.string().nullable(),
    best: z.string(),
  }),
]);

export const lessonPlanSchema = z.object({
  version: z.number(),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  provider: z.string().min(1),
  blocks: z.array(
    z.object({
      index: z.number(),
      title: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      startMs: z.number(),
      isFinal: z.boolean(),
      exercises: z.array(storedExerciseSchema),
    }),
  ),
});
