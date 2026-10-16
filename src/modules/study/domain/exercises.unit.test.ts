import { describe, expect, it } from "vitest";
import { arrangeLesson, correctAnswerText, gradeAnswer, type Exercise } from "./exercises";

const base = { cueId: "c1", startMs: 0, translation: "Oi" };
const LESSON: Exercise[] = [
  { ...base, id: "i", kind: "intro", english: "Hey there", portuguese: "Oi" },
  {
    ...base,
    id: "a",
    kind: "choice",
    prompt: "choice",
    english: "Hey",
    options: ["oi", "tchau", "sim", "não"],
    answer: 0,
  },
  {
    ...base,
    id: "b",
    kind: "listen",
    prompt: "listen",
    english: "Hey",
    options: ["hey", "hay", "hi"],
    answer: 2,
  },
  {
    ...base,
    id: "c",
    kind: "order",
    prompt: "orderFromHint",
    hint: "Oi",
    bank: ["hey", "there", "you"],
    solution: ["hey", "there"],
  },
  {
    ...base,
    id: "d",
    kind: "blank",
    prompt: "blank",
    before: "Hey",
    after: ".",
    hint: null,
    options: ["there", "where", "here"],
    answer: 0,
  },
  { ...base, id: "e", kind: "type", prompt: "typeFromHint", hint: "Oi", best: "Hey there" },
];

describe("ordem da lição", () => {
  it("mantém a introdução no começo e embaralha o resto de forma reproduzível pela semente", () => {
    const one = arrangeLesson(LESSON, "semente-1");
    expect(one[0]?.id).toBe("i");
    expect(one.map((exercise) => exercise.id).sort()).toEqual(["a", "b", "c", "d", "e", "i"]);
    expect(arrangeLesson(LESSON, "semente-1")).toEqual(one);
    const orders = new Set(
      Array.from({ length: 12 }, (_, index) =>
        arrangeLesson(LESSON, `s${index}`)
          .map((exercise) => exercise.id)
          .join(""),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("embaralhar as opções preserva a resposta certa", () => {
    for (let index = 0; index < 10; index += 1) {
      const arranged = arrangeLesson(LESSON, `x${index}`);
      for (const exercise of arranged) {
        const original = LESSON.find((candidate) => candidate.id === exercise.id);
        expect(original && correctAnswerText(exercise)).toBe(original && correctAnswerText(original));
        if (exercise.kind === "choice" || exercise.kind === "listen" || exercise.kind === "blank") {
          expect(gradeAnswer(exercise, exercise.answer)).toBe(true);
        }
        if (exercise.kind === "order") {
          const answer = exercise.solution.map((token) => exercise.bank.indexOf(token));
          expect(gradeAnswer(exercise, answer)).toBe(true);
        }
      }
    }
  });
});
