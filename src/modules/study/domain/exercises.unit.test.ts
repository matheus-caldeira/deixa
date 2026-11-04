import { describe, expect, it } from "vitest";
import { adaptToChallenge, arrangeLesson, correctAnswerText, gradeAnswer, type Exercise } from "./exercises";

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

describe("desafio pelo retrato do aluno", () => {
  const hints = (exercises: Exercise[]) =>
    exercises.map((exercise) =>
      "hint" in exercise ? `${exercise.id}:${exercise.prompt}:${exercise.hint}` : null,
    );

  it("subir tira as dicas, aliviar põe a tradução como dica e manter não muda nada", () => {
    expect(hints(LESSON.map((exercise) => adaptToChallenge(exercise, "harder")))).toEqual([
      null,
      null,
      null,
      "c:orderFromAudio:null",
      "d:blank:null",
      "e:dictation:null",
    ]);
    expect(hints(LESSON.map((exercise) => adaptToChallenge(exercise, "easier")))).toEqual([
      null,
      null,
      null,
      "c:orderFromHint:Oi",
      "d:blank:Oi",
      "e:typeFromHint:Oi",
    ]);
    expect(LESSON.map((exercise) => adaptToChallenge(exercise, "steady"))).toEqual(LESSON);
  });

  it("sem tradução, aliviar não inventa dica", () => {
    const bare = LESSON.map((exercise) => ({ ...exercise, translation: null }) as Exercise);
    expect(bare.map((exercise) => adaptToChallenge(exercise, "easier"))).toEqual(bare);
  });

  it("com a mesma semente, ordem, opções e respostas não dependem do desafio", () => {
    for (let index = 0; index < 10; index += 1) {
      const steady = arrangeLesson(LESSON, `d${index}`);
      for (const challenge of ["easier", "harder"] as const) {
        const adapted = arrangeLesson(LESSON, `d${index}`, challenge);
        expect(adapted.map((exercise) => exercise.id)).toEqual(steady.map((exercise) => exercise.id));
        expect(adapted.map(correctAnswerText)).toEqual(steady.map(correctAnswerText));
        adapted.forEach((exercise, position) => {
          const reference = steady[position];
          if (exercise.kind === "choice" || exercise.kind === "listen" || exercise.kind === "blank") {
            expect(reference && gradeAnswer(reference, exercise.answer)).toBe(true);
          }
          if (exercise.kind === "order") {
            const answer = exercise.solution.map((token) => exercise.bank.indexOf(token));
            expect(reference && gradeAnswer(reference, answer)).toBe(true);
          }
        });
      }
    }
  });
});
