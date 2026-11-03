import type { LanguagePair } from "@/shared/study-languages";
import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { SequentialIds } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import {
  PASS_ACCURACY,
  buildLesson,
  correctAnswerText,
  gradeAnswer,
  isGradable,
  lessonXp,
  normalizeAnswer,
  normalizeOption,
  type Answer,
  type Exercise,
} from "../domain/exercises";
import { assemblePlan, fallbackPlan, type LessonPlan } from "../domain/plan";
import { buildTrail, nodeStates, trailProgressPercent, type TrailLine } from "../domain/trail";
import {
  PLAN_TIMEOUT_MS,
  makeCompleteLesson,
  makeEnsurePlan,
  makeGeneratePlan,
  makeGetTrail,
  makeStartLesson,
  type LessonAttempt,
  type LessonPlanner,
  type PlanRepository,
  type StoredPlan,
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

const AI_PLAN = {
  blocks: [
    {
      title: "Planos para a noite",
      startLine: 0,
      endLine: 3,
      exercises: [
        {
          kind: "meaning",
          line: 0,
          translation: "Ei, o que você vai fazer hoje à noite?",
          distractors: [
            "Ei, onde você estava ontem à noite?",
            "Ei, o que você fez hoje de manhã?",
            "Ei, você vai trabalhar hoje à noite?",
          ],
        },
        {
          kind: "listen",
          line: 1,
          translation: "Nada demais. Ia ficar em casa.",
          distractors: ["Nothing much. I was gonna stay out.", "Nothing more. I was gonna step in."],
        },
        {
          kind: "blank",
          line: 2,
          translation: "Qual é, vamos sair.",
          word: "hang",
          distractors: ["hand", "hold"],
        },
        {
          kind: "order",
          line: 3,
          translation: "Fechado. A primeira rodada é por minha conta.",
          extraWords: ["off", "at"],
        },
      ],
    },
    {
      title: "O encontro que deu errado",
      startLine: 4,
      endLine: 7,
      exercises: [
        {
          kind: "meaning",
          line: 5,
          translation: "Sinceramente? Foi um desastre total.",
          distractors: [
            "Sinceramente? Foi um sucesso total.",
            "De verdade? Foi um dia normal.",
            "Sério? Foi um pouco chato.",
          ],
        },
        {
          kind: "listen",
          line: 6,
          distractors: ["Did you at last split the bill?", "Did you at least spill the beer?"],
        },
        {
          kind: "meaning",
          line: 7,
          translation: "Promete?",
          distractors: ["Pronto?", "Problema?", "Permite?"],
        },
        { kind: "type", line: 4 },
        { kind: "blank", line: 99, word: "x", distractors: ["a", "b"] },
        { kind: "poema", line: 4 },
      ],
    },
    {
      title: "Depois de tantos anos",
      startLine: 8,
      endLine: 10,
      exercises: [
        { kind: "blank", line: 8, word: "believe", distractors: ["belong", "behave"] },
        {
          kind: "listen",
          line: 9,
          distractors: ["Are you gonna ask her in or not?", "Are you gonna call her out or not?"],
        },
        { kind: "order", line: 10, extraWords: ["day"] },
      ],
    },
  ],
  finalExercises: [
    {
      kind: "listen",
      line: 0,
      distractors: ["Hey, what are you up to tomorrow?", "Hey, where are you off to tonight?"],
    },
    {
      kind: "meaning",
      line: 3,
      translation: "Fechado. A primeira rodada é por minha conta.",
      distractors: ["Fechado. A última rodada é por sua conta.", "Combinado. A primeira corrida é comigo."],
    },
    { kind: "blank", line: 5, word: "disaster", distractors: ["distance", "dessert"] },
    { kind: "type", line: 6 },
    { kind: "order", line: 8 },
    {
      kind: "listen",
      line: 10,
      distractors: ["Now can we please call it a day?", "Now can we please fall in a line?"],
    },
  ],
};

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

const wrongAnswer = (exercise: Exercise): Answer => (exercise.kind === "intro" ? null : "resposta errada");

describe("trilha em blocos", () => {
  it("agrupa as falas ditas entre um bloco e o próximo e libera um bloco por vez", () => {
    const trail = buildTrail(LINES);
    expect(trail.map((node) => node.lines.length)).toEqual([4, 4, 3]);
    expect(nodeStates(3, new Set([0]))).toEqual(["done", "current", "locked"]);
    expect(trailProgressPercent(4, new Set([0, 1]))).toBe(50);
  });
});

describe("plano de estudo gerado por IA", () => {
  const plan = assemblePlan({
    raw: AI_PLAN,
    lines: LINES,
    level: "B1",
    seed: "ep-1",
    provider: "gemini",
  }) as LessonPlan;

  it("usa os blocos e títulos da IA e fecha com o desafio final do episódio inteiro", () => {
    expect(plan.blocks.map((block) => [block.title, block.startLine, block.endLine, block.isFinal])).toEqual([
      ["Planos para a noite", 0, 3, false],
      ["O encontro que deu errado", 4, 7, false],
      ["Depois de tantos anos", 8, 10, false],
      ["", 0, 10, true],
    ]);
    const final = plan.blocks[3];
    expect(final?.exercises.length).toBeGreaterThanOrEqual(6);
    expect(new Set(final?.exercises.map((exercise) => exercise.cueId)).size).toBeGreaterThan(4);
  });

  it("cada bloco abre apresentando a primeira fala e descarta exercício inválido da IA", () => {
    expect(plan.blocks[0]?.exercises.map((exercise) => exercise.kind)).toEqual([
      "intro",
      "choice",
      "listen",
      "blank",
      "order",
    ]);
    const second = plan.blocks[1]?.exercises ?? [];
    expect(second.map((exercise) => exercise.kind)).toEqual(["intro", "choice", "listen", "choice", "type"]);
    expect(second.every((exercise) => exercise.cueId.startsWith("cue-1-"))).toBe(true);
  });

  it("normaliza as alternativas: tudo minúsculo e sem pontuação final, para não entregar a resposta", () => {
    const options = plan.blocks.flatMap((block) =>
      block.exercises.flatMap((exercise) =>
        "options" in exercise ? exercise.options : "bank" in exercise ? exercise.bank : [],
      ),
    );
    expect(options.length).toBeGreaterThan(20);
    expect(options.filter((option) => option !== option.toLowerCase() || /[.!?,]$/.test(option))).toEqual([]);
    expect(normalizeOption(' "Deal. First round\'s on me!" ')).toBe("deal. first round's on me");
  });

  it("no exercício de escuta as opções têm tamanho parecido com a fala certa", () => {
    const listens = plan.blocks.flatMap((block) =>
      block.exercises.filter((exercise) => exercise.kind === "listen"),
    );
    expect(listens.length).toBeGreaterThanOrEqual(3);
    for (const listen of listens) {
      if (listen.kind !== "listen") continue;
      const sizes = listen.options.map((option) => option.split(" ").length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("guarda a tradução da fala em cada exercício, inclusive a que só a IA forneceu", () => {
    const orphan = plan.blocks[1]?.exercises.find((exercise) => exercise.cueId === "cue-1-3");
    expect(orphan).toMatchObject({ kind: "choice", translation: "Promete?" });
    expect(plan.blocks[0]?.exercises[1]?.translation).toBe("Ei, o que você vai fazer hoje à noite?");
  });

  it("cai para os blocos por cena quando a IA devolve limites que não cobrem o episódio", () => {
    const broken = { ...AI_PLAN, blocks: [{ ...AI_PLAN.blocks[0], startLine: 2, endLine: 30 }] };
    const repaired = assemblePlan({
      raw: broken,
      lines: LINES,
      level: "A1",
      seed: "ep-1",
      provider: "gemini",
    });
    expect(repaired?.blocks.map((block) => [block.startLine, block.endLine])).toEqual([
      [0, 3],
      [4, 7],
      [8, 10],
      [0, 10],
    ]);
    expect(repaired?.blocks.every((block) => block.exercises.filter(isGradable).length >= 3)).toBe(true);
    expect(
      assemblePlan({ raw: "texto solto", lines: LINES, level: "A1", seed: "x", provider: "gemini" }),
    ).toBeNull();
  });

  it("recusa texto da IA com link ou marcação", () => {
    const hostile = {
      blocks: [
        {
          title: "<b>Bloco</b>",
          startLine: 0,
          endLine: 10,
          exercises: [
            {
              kind: "meaning",
              line: 0,
              translation: "veja https://exemplo.test",
              distractors: ["a", "b", "c"],
            },
          ],
        },
      ],
      finalExercises: [],
    };
    const built = assemblePlan({ raw: hostile, lines: LINES, level: "A1", seed: "x", provider: "gemini" });
    expect(built?.blocks[0]?.title).toBe("");
    expect(JSON.stringify(built)).not.toContain("exemplo.test");
  });

  it("sem IA, monta um plano de reserva determinístico e diferente por nível", () => {
    const a1 = fallbackPlan(LINES, "A1", "ep-1");
    const c1 = fallbackPlan(LINES, "C1", "ep-1");
    expect(a1).toEqual(fallbackPlan(LINES, "A1", "ep-1"));
    expect(a1?.provider).toBe("fallback");
    const kinds = (plan: LessonPlan | null) => plan?.blocks[0]?.exercises.map((exercise) => exercise.kind);
    expect(kinds(a1)).not.toEqual(kinds(c1));
    expect(kinds(a1)).not.toContain("type");
    for (const block of a1?.blocks ?? []) {
      for (const exercise of block.exercises) expect(gradeAnswer(exercise, rightAnswer(exercise))).toBe(true);
    }
  });
});

describe("correção e XP", () => {
  it("aceita variação de pontuação e de caixa na resposta digitada, mas não outra frase", () => {
    const typed: Exercise = {
      id: "0",
      cueId: "c",
      startMs: 0,
      translation: null,
      kind: "type",
      prompt: "blank",
      hint: null,
      best: "I can't take it anymore.",
    };
    expect(gradeAnswer(typed, "i can’t take it anymore")).toBe(true);
    expect(gradeAnswer(typed, "I can take it")).toBe(false);
    expect(normalizeAnswer(" Deal.  First round's on me! ")).toBe("deal first round's on me");
    expect(correctAnswerText(typed)).toBe("I can't take it anymore.");
  });

  it("só paga XP por acertos e só acima do mínimo; metade na repetição e nada depois do limite", () => {
    expect(lessonXp({ correct: 6, total: 6, replay: false, replaysToday: 0 })).toBe(23);
    expect(lessonXp({ correct: 5, total: 6, replay: false, replaysToday: 0 })).toBe(15);
    expect(lessonXp({ correct: 4, total: 6, replay: false, replaysToday: 0 })).toBe(0);
    expect(lessonXp({ correct: 0, total: 6, replay: false, replaysToday: 0 })).toBe(0);
    expect(lessonXp({ correct: 6, total: 6, replay: true, replaysToday: 1 })).toBe(12);
    expect(lessonXp({ correct: 6, total: 6, replay: true, replaysToday: 2 })).toBe(0);
    expect(
      buildLesson({ seed: "s", level: "B1", nodeLines: LINES.slice(0, 4), allLines: LINES }),
    ).toHaveLength(6);
  });
});

function setup(planner: LessonPlanner | null = { name: "gemini", plan: async () => AI_PLAN }) {
  const attempts: LessonAttempt[] = [];
  const stored = new Map<string, StoredPlan>();
  const xp: { userId: string; amount: number }[] = [];
  const paidKeys = new Set<string>();
  const progress = new Map<string, number>();
  const queued: { userId: string; items: { cueId: string; translation: string | null }[] }[] = [];
  const sent: { userId: string; kind: string; params: Record<string, string | number> }[] = [];
  const clock = new FixedClock("2026-10-10T15:00:00Z");
  const key = (episodeId: string, level: CefrLevel) => `${episodeId}:${level}`;
  const study: StudyRepository = {
    listAttempts: async (userId, episodeId, _pair, level) =>
      attempts.filter((a) => a.userId === userId && a.episodeId === episodeId && a.level === level),
    saveAttempt: async (attempt) => {
      attempts.push(attempt);
    },
  };
  const plans: PlanRepository = {
    find: async (episodeId, _pair, level) => stored.get(key(episodeId, level)) ?? null,
    markPending: async (input) => {
      const current = stored.get(key(input.episodeId, input.level));
      if (current?.status === "READY") return false;
      if (current?.status === "PENDING" && current.updatedAt >= input.staleBefore) return false;
      stored.set(key(input.episodeId, input.level), {
        status: "PENDING",
        plan: null,
        failureReason: null,
        updatedAt: input.now,
      });
      return true;
    },
    saveReady: async (input) => {
      if (stored.get(key(input.episodeId, input.level))?.status === "READY") return;
      stored.set(key(input.episodeId, input.level), {
        status: "READY",
        plan: input.plan,
        failureReason: null,
        updatedAt: input.now,
      });
    },
    markFailed: async (input) => {
      if (stored.get(key(input.episodeId, input.level))?.status !== "PENDING") return;
      stored.set(key(input.episodeId, input.level), {
        status: "FAILED",
        plan: null,
        failureReason: input.reason,
        updatedAt: input.now,
      });
    },
  };
  let activePlanner = planner;
  let outOfBudget = false;
  const deps = {
    study,
    plans,
    clock,
    ids: new SequentialIds("at"),
    loadLines: async (episodeId: string, _pair: LanguagePair) => (episodeId === "ep-1" ? LINES : null),
    resolvePlanner: async (_userId: string) => {
      if (outOfBudget) throw new AppError("AI_LIMIT_REACHED", "limite diário");
      return activePlanner;
    },
    notify: async (notification: {
      userId: string;
      kind: string;
      params: Record<string, string | number>;
    }) => {
      sent.push({ userId: notification.userId, kind: notification.kind, params: notification.params });
    },
    awardXp: async (input: { userId: string; source: string; sourceId: string; amount: number }) => {
      const paidKey = `${input.userId}:${input.source}:${input.sourceId}`;
      if (paidKeys.has(paidKey)) return;
      paidKeys.add(paidKey);
      xp.push({ userId: input.userId, amount: input.amount });
    },
    saveProgress: async (userId: string, episodeId: string, percent: number) => {
      progress.set(`${userId}:${episodeId}`, percent);
    },
    queueForReview: async (
      userId: string,
      _episodeId: string,
      _pair: LanguagePair,
      items: { cueId: string; translation: string | null }[],
    ) => {
      queued.push({ userId, items });
      return items.length;
    },
  };
  return {
    attempts,
    stored,
    xp,
    progress,
    queued,
    sent,
    clock,
    setPlanner: (next: LessonPlanner | null) => {
      activePlanner = next;
    },
    setOutOfBudget: (value: boolean) => {
      outOfBudget = value;
    },
    ensure: makeEnsurePlan(deps),
    generate: makeGeneratePlan(deps),
    trail: makeGetTrail(deps),
    start: makeStartLesson(deps),
    complete: makeCompleteLesson(deps),
  };
}

const PAIR = { target: "en", native: "pt-BR" } as const;
const job = {
  userId: "ana",
  episodeId: "ep-1",
  pair: PAIR,
  level: "B1" as const,
  episodeLabel: "Friends · T1 · E1",
};
const base = {
  userId: "ana",
  episodeId: "ep-1",
  pair: PAIR,
  level: "B1" as const,
  timezone: "America/Sao_Paulo",
};

async function ready(app: ReturnType<typeof setup>) {
  const status = await app.ensure(job);
  if (status.status === "PENDING" && status.job) await app.generate(status.job);
}

describe("geração da trilha em segundo plano", () => {
  it("fica pendente, gera com a IA e avisa quando a trilha está pronta", async () => {
    const app = setup();
    const first = await app.ensure(job);
    expect(first).toMatchObject({ status: "PENDING", job });
    expect(await app.ensure(job)).toEqual({ status: "PENDING", job: null });
    await expect(app.trail("ana", "ep-1", PAIR, "B1")).rejects.toMatchObject({ code: "EPISODE_NOT_READY" });

    await app.generate(job);
    expect(await app.ensure(job)).toEqual({ status: "READY" });
    expect(app.sent).toEqual([
      {
        userId: "ana",
        kind: "trail_ready",
        params: expect.objectContaining({ level: "B1", episode: "Friends · T1 · E1" }),
      },
    ]);
    const trail = await app.trail("ana", "ep-1", PAIR, "B1");
    expect(trail.generatedByAi).toBe(true);
    expect(trail.nodes.map((node) => [node.title, node.state, node.icon])).toEqual([
      ["Planos para a noite", "current", "quote"],
      ["O encontro que deu errado", "locked", "ear"],
      ["Depois de tantos anos", "locked", "pen"],
      ["", "locked", "chest"],
    ]);
  });

  it("dois pedidos ao mesmo tempo agendam a geração da trilha uma vez só", async () => {
    const app = setup();
    const results = await Promise.all([app.ensure(job), app.ensure({ ...job, userId: "lucas" })]);
    expect(results.filter((result) => result.status === "PENDING" && result.job !== null)).toHaveLength(1);
  });

  it("o plano é do episódio e do nível: outro usuário do mesmo nível reaproveita, outro nível gera o seu", async () => {
    const app = setup();
    await ready(app);
    expect(await app.ensure({ ...job, userId: "lucas" })).toEqual({ status: "READY" });
    expect((await app.ensure({ ...job, userId: "lucas", level: "C1" })).status).toBe("PENDING");
  });

  it("registra a falha, avisa e permite tentar de novo; pendência velha não trava", async () => {
    const app = setup({
      name: "gemini",
      plan: async () => {
        throw new Error("timeout");
      },
    });
    const first = await app.ensure(job);
    if (first.status === "PENDING" && first.job) await app.generate(first.job);
    expect(await app.ensure(job)).toMatchObject({ status: "FAILED" });
    expect(app.sent[0]).toMatchObject({ kind: "trail_failed" });

    app.setPlanner({ name: "gemini", plan: async () => AI_PLAN });
    const retry = await app.ensure({ ...job, retry: true });
    expect(retry.status).toBe("PENDING");
    app.clock.advanceMs(PLAN_TIMEOUT_MS + 1000);
    expect((await app.ensure(job)).status).toBe("PENDING");
    expect((await app.ensure(job)).status).toBe("PENDING");
  });

  it("um trabalho atrasado não derruba nem troca uma trilha que já ficou pronta", async () => {
    const app = setup();
    await ready(app);
    const before = app.stored.get("ep-1:B1")?.plan;
    app.setPlanner({
      name: "gemini",
      plan: async () => {
        throw new Error("timeout");
      },
    });
    await app.generate(job);
    expect(app.stored.get("ep-1:B1")).toMatchObject({ status: "READY" });
    app.setPlanner({
      name: "gemini",
      plan: async () => ({ ...AI_PLAN, blocks: AI_PLAN.blocks.slice(0, 1) }),
    });
    await app.generate(job);
    expect(app.stored.get("ep-1:B1")?.plan).toBe(before);
  });

  it("conta sem saldo de IA recebe o aviso sem mexer na trilha compartilhada dos outros", async () => {
    const app = setup();
    app.setOutOfBudget(true);
    await expect(app.ensure(job)).rejects.toMatchObject({ code: "AI_LIMIT_REACHED" });
    expect(app.stored.size).toBe(0);
    await expect(app.ensure({ ...job, retry: true })).rejects.toMatchObject({ code: "AI_LIMIT_REACHED" });
    expect(app.stored.size).toBe(0);

    app.setOutOfBudget(false);
    await ready(app);
    app.setOutOfBudget(true);
    expect(await app.ensure({ ...job, userId: "lucas" })).toEqual({ status: "READY" });
    expect(await app.ensure({ ...job, retry: true })).toEqual({ status: "READY" });
  });

  it("sem chave de IA, usa o plano de reserva na hora", async () => {
    const app = setup(null);
    expect(await app.ensure(job)).toEqual({ status: "READY" });
    expect((await app.trail("ana", "ep-1", PAIR, "B1")).generatedByAi).toBe(false);
    await expect(app.ensure({ ...job, episodeId: "sem-legenda" })).rejects.toMatchObject({
      code: "EPISODE_NOT_READY",
    });
  });
});

describe("sessão de estudo", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(async () => {
    app = setup();
    await ready(app);
  });

  it("aprova com o mínimo de acerto, paga XP só pelos acertos e libera o próximo bloco", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    expect(lesson).toMatchObject({ title: "Planos para a noite", replay: false, isFinal: false });
    const result = await app.complete({
      ...base,
      nodeIndex: 0,
      seed: lesson.seed,
      answers: lesson.exercises.map(rightAnswer),
      seconds: 75,
    });
    expect(result).toMatchObject({
      passed: true,
      accuracy: 100,
      correct: 4,
      total: 4,
      xp: 17,
      progressPercent: 25,
      nextNodeIndex: 1,
      queuedForReview: 0,
    });
    expect(app.xp).toEqual([{ userId: "ana", amount: 17 }]);
    expect(app.progress.get("ana:ep-1")).toBe(25);
  });

  it("reprova abaixo do mínimo: sem XP, bloco não concluído e todos os erros na revisão", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    const result = await app.complete({
      ...base,
      nodeIndex: 0,
      seed: lesson.seed,
      answers: lesson.exercises.map(wrongAnswer),
      seconds: 20,
    });
    expect(result).toMatchObject({
      passed: false,
      accuracy: 0,
      xp: 0,
      requiredAccuracy: PASS_ACCURACY,
      nextNodeIndex: 0,
      progressPercent: 0,
    });
    expect(app.xp).toEqual([]);
    expect(app.progress.size).toBe(0);
    expect(app.queued[0]?.items.map((item) => item.cueId).sort()).toEqual([
      "cue-0-0",
      "cue-0-1",
      "cue-0-2",
      "cue-0-3",
    ]);
    expect(app.queued[0]?.items.every((item) => item.translation !== null)).toBe(true);
    expect((await app.trail("ana", "ep-1", PAIR, "B1")).nodes[0]?.state).toBe("current");
    await expect(app.start({ ...base, nodeIndex: 1 })).rejects.toMatchObject({ code: "EPISODE_NOT_READY" });
  });

  it("um erro num bloco aprovado também vai para a revisão", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    const answers = lesson.exercises.map((exercise, index) =>
      index === 1 ? wrongAnswer(exercise) : rightAnswer(exercise),
    );
    const result = await app.complete({ ...base, nodeIndex: 0, seed: lesson.seed, answers, seconds: 60 });
    expect(result).toMatchObject({ passed: true, accuracy: 75, xp: 9, queuedForReview: 1 });
  });

  it("o desafio final revisa o episódio inteiro e só conclui o episódio com aprovação", async () => {
    for (const nodeIndex of [0, 1, 2]) {
      const lesson = await app.start({ ...base, nodeIndex });
      await app.complete({
        ...base,
        nodeIndex,
        seed: lesson.seed,
        answers: lesson.exercises.map(rightAnswer),
        seconds: 60,
      });
    }
    const final = await app.start({ ...base, nodeIndex: 3 });
    expect(final).toMatchObject({ title: "", isFinal: true });
    const failed = await app.complete({
      ...base,
      nodeIndex: 3,
      seed: final.seed,
      answers: final.exercises.map(wrongAnswer),
      seconds: 60,
    });
    expect(failed).toMatchObject({ passed: false, episodeCompleted: false, progressPercent: 75 });
    const passed = await app.complete({
      ...base,
      nodeIndex: 3,
      seed: final.seed,
      answers: final.exercises.map(rightAnswer),
      seconds: 60,
    });
    expect(passed).toMatchObject({
      passed: true,
      episodeCompleted: true,
      progressPercent: 100,
      nextNodeIndex: null,
    });
  });

  it("cada abertura embaralha exercícios e opções, e a correção usa a mesma ordem", async () => {
    const first = await app.start({ ...base, nodeIndex: 0 });
    const second = await app.start({ ...base, nodeIndex: 0 });
    expect(first.seed).not.toBe(second.seed);
    expect(first.exercises[0]?.kind).toBe("intro");
    expect([...first.exercises].map((exercise) => exercise.id).sort()).toEqual(
      [...second.exercises].map((exercise) => exercise.id).sort(),
    );
    const result = await app.complete({
      ...base,
      nodeIndex: 0,
      seed: second.seed,
      answers: second.exercises.map(rightAnswer),
      seconds: 30,
    });
    expect(result.accuracy).toBe(100);
  });

  it("não aceita quantidade de respostas diferente da lição", async () => {
    await expect(
      app.complete({ ...base, nodeIndex: 0, seed: "s", answers: [], seconds: 1 }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("repetir rende metade e para de render no mesmo dia; envios simultâneos pagam uma vez", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    const answers = lesson.exercises.map(rightAnswer);
    const [first, second] = await Promise.all([
      app.complete({ ...base, nodeIndex: 0, seed: lesson.seed, answers, seconds: 60 }),
      app.complete({ ...base, nodeIndex: 0, seed: lesson.seed, answers, seconds: 60 }),
    ]);
    expect(app.xp).toEqual([{ userId: "ana", amount: Math.max(first.xp, second.xp) }]);
    const earned: number[] = [];
    for (let round = 0; round < 3; round += 1) {
      earned.push(
        (await app.complete({ ...base, nodeIndex: 0, seed: lesson.seed, answers, seconds: 60 })).xp,
      );
    }
    expect(earned.at(-1)).toBe(0);
    expect(app.xp.reduce((total, event) => total + event.amount, 0)).toBeLessThanOrEqual(17 + 9);
  });

  it("o progresso de um usuário não mexe na trilha do outro", async () => {
    const lesson = await app.start({ ...base, nodeIndex: 0 });
    await app.complete({
      ...base,
      nodeIndex: 0,
      seed: lesson.seed,
      answers: lesson.exercises.map(rightAnswer),
      seconds: 60,
    });
    const lucas = await app.trail("lucas", "ep-1", PAIR, "B1");
    expect(lucas.nodes.map((node) => node.state)).toEqual(["current", "locked", "locked", "locked"]);
    expect(lucas.progressPercent).toBe(0);
  });
});
