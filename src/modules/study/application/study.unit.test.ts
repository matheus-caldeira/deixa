import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import {
  buildLesson,
  correctAnswerText,
  gradeAnswer,
  lessonXp,
  normalizeAnswer,
  type Answer,
  type Exercise,
} from "../domain/exercises";
import { buildTrail, nodeStates, trailProgressPercent, type TrailLine } from "../domain/trail";
import {
  makeCompleteLesson,
  makeGetTrail,
  makeStartLesson,
  type LessonAttempt,
  type StudyRepository,
} from "./study-use-cases";

const SCENES: [string, string | null][][] = [
  [
    ["Hey, what are you up to tonight?", "Ei, o que você vai fazer hoje à noite?"],
    ["Nothing much. I was gonna stay in.", "Nada demais. Ia ficar em casa."],
    ["Come on, let's hang out.", "Qual é, vamos sair."],
    ["Deal. First round's on me.", "Fechado. A primeira rodada é por minha conta."],
  ],
  [
    ["So, how did the date go?", "E aí, como foi o encontro?"],
    ["Honestly? It was a total disaster.", "Sinceramente? Foi um desastre total."],
    ["Did you at least split the bill?", "Pelo menos vocês dividiram a conta?"],
    ["Promise?", null],
  ],
  [
    ["I can't believe I ran into her.", "Não acredito que esbarrei com ela."],
    ["Are you gonna ask her out or not?", "Vai chamar ela pra sair ou não?"],
    ["Now can we please call it a night?", "Agora a gente pode encerrar a noite?"],
  ],
];

const LINES: TrailLine[] = SCENES.flatMap((scene, sceneIndex) =>
  scene.map(([text, translation], index) => ({
    cueId: `cue-${sceneIndex}-${index}`,
    startMs: sceneIndex * 200_000 + index * 3000,
    text,
    sceneIndex,
    translation,
  })),
);

function rightAnswer(exercise: Exercise): Answer {
  if (exercise.kind === "intro") return null;
  if (exercise.kind === "order") {
    const used = new Set<number>();
    return exercise.solution.map((token) => {
      const index = exercise.bank.findIndex(
        (candidate, position) => candidate === token && !used.has(position),
      );
      used.add(index);
      return index;
    });
  }
  if (exercise.kind === "type") return exercise.best;
  return exercise.answer;
}

describe("trilha do episódio", () => {
  it("transforma cada cena numa parada, com o tempo da primeira fala, e fecha com o desafio final", () => {
    const trail = buildTrail(LINES);
    expect(trail.map((node) => [node.title, node.startMs, node.icon, node.lines.length])).toEqual([
      ["Cena 1", 0, "quote", 4],
      ["Cena 2", 200_000, "ear", 4],
      ["Desafio final", 400_000, "chest", 3],
    ]);
  });

  it("junta cenas quando o episódio tem cenas demais", () => {
    const many = Array.from(
      { length: 30 },
      (_, index) => ({ ...LINES[0], cueId: `c${index}`, sceneIndex: index }) as TrailLine,
    );
    const trail = buildTrail(many);
    expect(trail).toHaveLength(8);
    expect(trail.reduce((total, node) => total + node.lines.length, 0)).toBe(30);
  });

  it("libera uma parada por vez", () => {
    expect(nodeStates(3, new Set())).toEqual(["current", "locked", "locked"]);
    expect(nodeStates(3, new Set([0]))).toEqual(["done", "current", "locked"]);
    expect(nodeStates(3, new Set([0, 1, 2]))).toEqual(["done", "done", "done"]);
    expect(trailProgressPercent(3, new Set([0]))).toBe(33);
  });
});

describe("exercícios da lição", () => {
  const lessonFor = (level: "A1" | "B1" | "C1") =>
    buildLesson({ seed: "ep-1:0", level, nodeLines: buildTrail(LINES)[0]?.lines ?? [], allLines: LINES });

  it("é determinística: a mesma cena e o mesmo nível geram a mesma lição", () => {
    expect(lessonFor("B1")).toEqual(lessonFor("B1"));
    expect(lessonFor("A1").length).toBeGreaterThanOrEqual(4);
  });

  it("gera exercícios diferentes para A1, B1 e C1 a partir do mesmo episódio", () => {
    const kinds = (level: "A1" | "B1" | "C1") => lessonFor(level).map((exercise) => exercise.kind);
    expect(kinds("A1")).not.toEqual(kinds("B1"));
    expect(kinds("B1")).not.toEqual(kinds("C1"));
    expect(kinds("A1")).not.toContain("type");
    expect(kinds("C1")).toContain("type");
    const dictation = lessonFor("C1").find((exercise) => exercise.kind === "type");
    expect(dictation).toMatchObject({ hint: null });
  });

  it("toda lição começa apresentando uma fala e cada exercício tem resposta certa entre as opções", () => {
    for (const level of ["A1", "B1", "C1"] as const) {
      const lesson = lessonFor(level);
      expect(lesson[0]?.kind).toBe("intro");
      for (const exercise of lesson) {
        expect(gradeAnswer(exercise, rightAnswer(exercise))).toBe(true);
        expect(correctAnswerText(exercise).length).toBeGreaterThan(0);
        if (exercise.kind === "choice" || exercise.kind === "listen" || exercise.kind === "blank") {
          expect(new Set(exercise.options).size).toBe(exercise.options.length);
          expect(gradeAnswer(exercise, (exercise.answer + 1) % exercise.options.length)).toBe(false);
        }
      }
    }
  });

  it("aceita variação de pontuação e de caixa na resposta digitada, mas não outra frase", () => {
    const typed: Exercise = {
      id: "0",
      cueId: "c",
      startMs: 0,
      kind: "type",
      prompt: "",
      hint: null,
      best: "I can't take it anymore.",
    };
    expect(gradeAnswer(typed, "i can’t take it anymore")).toBe(true);
    expect(gradeAnswer(typed, "I can take it")).toBe(false);
    expect(normalizeAnswer(" Deal.  First round's on me! ")).toBe("deal first round's on me");
  });

  it("não usa exercício de significado em fala sem tradução", () => {
    const orphan = LINES.filter((line) => line.translation === null);
    const lesson = buildLesson({ seed: "x", level: "A1", nodeLines: orphan, allLines: LINES });
    expect(lesson.every((exercise) => exercise.kind !== "choice")).toBe(true);
  });

  it("paga XP cheio na primeira vez, metade na repetição e nada depois do limite diário", () => {
    expect(lessonXp({ correct: 6, total: 6, replay: false, replaysToday: 0 })).toBe(33);
    expect(lessonXp({ correct: 4, total: 6, replay: false, replaysToday: 0 })).toBe(22);
    expect(lessonXp({ correct: 6, total: 6, replay: true, replaysToday: 1 })).toBe(17);
    expect(lessonXp({ correct: 6, total: 6, replay: true, replaysToday: 2 })).toBe(0);
  });
});

function setup() {
  const attempts: LessonAttempt[] = [];
  const xp: { userId: string; amount: number }[] = [];
  const paidKeys = new Set<string>();
  const progress = new Map<string, number>();
  const queued: { userId: string; cueIds: string[] }[] = [];
  const study: StudyRepository = {
    listAttempts: async (userId, episodeId) =>
      attempts.filter((attempt) => attempt.userId === userId && attempt.episodeId === episodeId),
    saveAttempt: async (attempt) => {
      attempts.push(attempt);
    },
  };
  const clock = new FixedClock("2026-10-10T15:00:00Z");
  const deps = {
    study,
    clock,
    ids: new SequentialIds("at"),
    loadLines: async (episodeId: string) => (episodeId === "ep-1" ? LINES : null),
    awardXp: async (input: { userId: string; source: string; sourceId: string; amount: number }) => {
      const key = `${input.userId}:${input.source}:${input.sourceId}`;
      if (paidKeys.has(key)) return;
      paidKeys.add(key);
      xp.push({ userId: input.userId, amount: input.amount });
    },
    saveProgress: async (userId: string, episodeId: string, percent: number) => {
      progress.set(`${userId}:${episodeId}`, percent);
    },
    queueForReview: async (userId: string, _episodeId: string, cueIds: string[]) => {
      queued.push({ userId, cueIds });
      return cueIds.length;
    },
  };
  return {
    attempts,
    xp,
    progress,
    queued,
    clock,
    trail: makeGetTrail(deps),
    start: makeStartLesson(deps),
    complete: makeCompleteLesson(deps),
  };
}

describe("sessão de estudo", () => {
  let app: ReturnType<typeof setup>;
  const base = { userId: "ana", episodeId: "ep-1", level: "A1" as const, timezone: "America/Sao_Paulo" };

  beforeEach(() => {
    app = setup();
  });

  it("corrige no servidor, paga XP, avança a trilha e atualiza o progresso do episódio", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    expect(lesson).toMatchObject({ title: "Cena 1", replay: false });
    const result = await app.complete({
      ...base,
      nodeIndex: 0,
      answers: lesson.exercises.map(rightAnswer),
      seconds: 75,
    });
    expect(result).toMatchObject({
      accuracy: 100,
      replay: false,
      progressPercent: 33,
      nextNodeIndex: 1,
      queuedForReview: 0,
    });
    expect(result.xp).toBe(10 + lesson.exercises.length * 3 + 5);
    expect(app.xp).toEqual([{ userId: "ana", amount: result.xp }]);
    expect(app.progress.get("ana:ep-1")).toBe(33);
    expect((await app.trail("ana", "ep-1")).nodes.map((node) => node.state)).toEqual([
      "done",
      "current",
      "locked",
    ]);
  });

  it("manda as falas erradas para a revisão e não aceita resposta inventada pelo cliente", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    const answers = lesson.exercises.map((exercise) => (exercise.kind === "intro" ? null : "errado"));
    const result = await app.complete({ ...base, nodeIndex: 0, answers, seconds: 30 });
    expect(result.correct).toBe(1);
    expect(result.xp).toBe(13);
    expect(app.queued[0]?.cueIds.length).toBeGreaterThan(0);
    await expect(app.complete({ ...base, nodeIndex: 0, answers: [], seconds: 1 })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("não deixa pular para uma cena bloqueada", async () => {
    await expect(app.start({ ...base, nodeIndex: 2 })).rejects.toMatchObject({ code: "EPISODE_NOT_READY" });
    await expect(app.complete({ ...base, nodeIndex: 2, answers: [], seconds: 1 })).rejects.toMatchObject({
      code: "EPISODE_NOT_READY",
    });
    await expect(app.trail("ana", "sem-legenda")).rejects.toMatchObject({ code: "EPISODE_NOT_READY" });
  });

  it("repetir a lição rende metade e para de render no mesmo dia: não há XP ilimitado", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    const answers = lesson.exercises.map(rightAnswer);
    const first = await app.complete({ ...base, nodeIndex: 0, answers, seconds: 60 });
    const earned: number[] = [];
    for (let round = 0; round < 4; round += 1) {
      const again = await app.complete({ ...base, nodeIndex: 0, answers, seconds: 60 });
      expect(again.replay).toBe(true);
      earned.push(again.xp);
    }
    expect(earned).toEqual([Math.round(first.xp / 2), 0, 0, 0]);
    app.clock.advanceDays(1);
    expect((await app.complete({ ...base, nodeIndex: 0, answers, seconds: 60 })).xp).toBe(
      Math.round(first.xp / 2),
    );
  });

  it("dois envios simultâneos da mesma lição pagam o XP uma única vez", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    const answers = lesson.exercises.map(rightAnswer);
    const [first, second] = await Promise.all([
      app.complete({ ...base, nodeIndex: 0, answers, seconds: 60 }),
      app.complete({ ...base, nodeIndex: 0, answers, seconds: 60 }),
    ]);
    expect(app.xp).toEqual([{ userId: "ana", amount: Math.max(first.xp, second.xp) }]);
  });

  it("o progresso de um usuário não mexe na trilha do outro", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    await app.complete({ ...base, nodeIndex: 0, answers: lesson.exercises.map(rightAnswer), seconds: 60 });
    expect((await app.trail("lucas", "ep-1")).nodes.map((node) => node.state)).toEqual([
      "current",
      "locked",
      "locked",
    ]);
    expect((await app.trail("lucas", "ep-1")).progressPercent).toBe(0);
  });
});
