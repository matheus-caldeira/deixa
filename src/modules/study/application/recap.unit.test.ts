import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { SequentialIds } from "@/shared/ids";
import type { LanguagePair } from "@/shared/study-languages";
import { MS_PER_DAY } from "@/shared/time";
import type { Answer, Exercise } from "../domain/exercises";
import { advanceRecap, pickRecapExercises, type Recap, type RecapSource } from "../domain/recap";
import {
  makeCompleteRecap,
  makeCountDueRecaps,
  makeListRecaps,
  makeStartRecap,
  type RecapRepository,
} from "./recap-use-cases";

const PAIR: LanguagePair = { target: "en", native: "pt-BR" };

function exercise(cueId: string, answer = 0): Exercise {
  return {
    kind: "choice",
    id: `ex-${cueId}`,
    cueId,
    startMs: 0,
    translation: null,
    prompt: "choice",
    english: cueId,
    options: ["certa", "errada"],
    answer,
  } as Exercise;
}

class InMemoryRecaps implements RecapRepository {
  readonly rows: (Recap & { pair: string })[] = [];
  async list(userId: string, pair: string) {
    return this.rows.filter((row) => row.userId === userId && row.pair === pair);
  }
  async find(userId: string, pair: string, recapId: string) {
    return this.rows.find((row) => row.id === recapId && row.userId === userId && row.pair === pair) ?? null;
  }
  async ensure(
    rows: { id: string; userId: string; source: RecapSource; episodeId: string; pair: string; dueAt: Date }[],
    now: Date,
  ) {
    for (const row of rows) {
      const known = this.rows.some(
        (candidate) =>
          candidate.userId === row.userId &&
          candidate.source === row.source &&
          candidate.episodeId === row.episodeId &&
          candidate.pair === row.pair,
      );
      if (!known) this.rows.push({ ...row, step: 0, updatedAt: now });
    }
  }
  async saveStep(userId: string, recapId: string, step: number, dueAt: Date | null, now: Date) {
    const row = this.rows.find((candidate) => candidate.id === recapId && candidate.userId === userId);
    if (row) Object.assign(row, { step, dueAt, updatedAt: now });
  }
}

function setup() {
  const recaps = new InMemoryRecaps();
  const clock = new FixedClock("2026-10-16T12:00:00Z");
  const xp: { userId: string; sourceId: string; amount: number }[] = [];
  const completed: Record<string, { source: RecapSource; episodeId: string }[]> = {
    ana: [
      { source: "catalog", episodeId: "ep-1" },
      { source: "personal", episodeId: "pe-1" },
    ],
    lucas: [],
  };
  const deps = {
    recaps,
    clock,
    ids: new SequentialIds("rc"),
    awardXp: async (input: { userId: string; source: string; sourceId: string; amount: number }) => {
      if (xp.some((entry) => entry.userId === input.userId && entry.sourceId === input.sourceId)) return;
      xp.push(input);
    },
    completedEpisodes: async (userId: string) => completed[userId] ?? [],
    describe: async (_userId: string, _pair: LanguagePair, source: RecapSource, episodeId: string) => ({
      workTitle: source === "catalog" ? "Obra" : "Minha série",
      label: { kind: "personal" as const, level: "B1", episode: 1 },
      title: episodeId,
      summary: "Resumo",
      cards: 2,
    }),
    material: async () => [exercise("c1"), exercise("c2"), exercise("c3")],
  };
  return {
    clock,
    recaps,
    xp,
    list: makeListRecaps(deps),
    count: makeCountDueRecaps(deps),
    start: makeStartRecap(deps),
    complete: makeCompleteRecap(deps),
  };
}

const right = (exercises: Exercise[]): Answer[] =>
  exercises.map((item) => (item.kind === "choice" ? item.answer : null));

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return isAppError(error) ? error.code : "unexpected";
  }
}

describe("recapitulação de episódios", () => {
  it("vence em 1, 7 e 30 dias e termina depois da terceira", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    const first = advanceRecap(0, now);
    expect(first.step).toBe(1);
    expect(first.dueAt?.getTime()).toBe(now.getTime() + 7 * MS_PER_DAY);
    expect(advanceRecap(1, now).dueAt?.getTime()).toBe(now.getTime() + 30 * MS_PER_DAY);
    expect(advanceRecap(2, now)).toEqual({ step: 3, dueAt: null });
  });

  it("prioriza as falas dos cards da pessoa e sorteia sempre igual para a mesma semente", () => {
    const pool = ["a", "b", "c", "d", "e", "f", "g", "h"].map((cue) => exercise(cue));
    const picked = pickRecapExercises({
      exercises: pool,
      focusCueIds: new Set(["g", "h"]),
      seed: "s",
      count: 4,
    });
    expect(picked).toHaveLength(4);
    expect(new Set(picked.slice(0, 2).map((item) => item.cueId))).toEqual(new Set(["g", "h"]));
    expect(pickRecapExercises({ exercises: pool, focusCueIds: new Set(), seed: "s" })).toEqual(
      pickRecapExercises({ exercises: pool, focusCueIds: new Set(), seed: "s" }),
    );
  });

  it("episódio concluído ganha recapitulação para amanhã, só para a própria conta", async () => {
    const app = setup();
    expect(await app.count({ userId: "ana", pair: PAIR })).toBe(0);
    const list = await app.list({ userId: "ana", pair: PAIR });
    expect(list.map((entry) => entry.episodeId).sort()).toEqual(["ep-1", "pe-1"]);
    expect(list.every((entry) => !entry.due)).toBe(true);
    expect(await app.list({ userId: "lucas", pair: PAIR })).toEqual([]);
    await app.list({ userId: "ana", pair: PAIR });
    expect(app.recaps.rows).toHaveLength(2);
    app.clock.advanceMs(MS_PER_DAY);
    expect(await app.count({ userId: "ana", pair: PAIR })).toBe(2);
    const id = list[0]?.id ?? "";
    expect(await codeOf(app.start({ userId: "lucas", pair: PAIR, level: "B1", recapId: id }))).toBe(
      "ITEM_NOT_FOUND",
    );
    expect(
      await codeOf(
        app.start({ userId: "ana", pair: { target: "es", native: "pt-BR" }, level: "B1", recapId: id }),
      ),
    ).toBe("ITEM_NOT_FOUND");
  });

  it("aprovada no vencimento avança a etapa e paga XP uma vez; fora do vencimento é só treino", async () => {
    const app = setup();
    const [entry] = await app.list({ userId: "ana", pair: PAIR });
    const id = entry?.id ?? "";
    const early = await app.start({ userId: "ana", pair: PAIR, level: "B1", recapId: id });
    const practice = await app.complete({
      userId: "ana",
      pair: PAIR,
      level: "B1",
      recapId: id,
      seed: early.seed,
      answers: right(early.exercises),
    });
    expect(practice.passed).toBe(true);
    expect(practice.xp).toBe(0);
    expect(practice.replay).toBe(true);
    app.clock.advanceMs(MS_PER_DAY);
    const lesson = await app.start({ userId: "ana", pair: PAIR, level: "B1", recapId: id });
    const result = await app.complete({
      userId: "ana",
      pair: PAIR,
      level: "B1",
      recapId: id,
      seed: lesson.seed,
      answers: right(lesson.exercises),
    });
    expect(result.passed).toBe(true);
    expect(result.xp).toBeGreaterThan(0);
    expect(result.recapNextInDays).toBe(7);
    expect(app.recaps.rows.find((row) => row.id === id)?.step).toBe(1);
    expect(app.xp).toHaveLength(1);
    expect(await app.count({ userId: "ana", pair: PAIR })).toBe(1);
  });

  it("errar mantém a recapitulação vencida", async () => {
    const app = setup();
    const [entry] = await app.list({ userId: "ana", pair: PAIR });
    app.clock.advanceMs(MS_PER_DAY);
    const lesson = await app.start({ userId: "ana", pair: PAIR, level: "B1", recapId: entry?.id ?? "" });
    const wrong = lesson.exercises.map((item): Answer => (item.kind === "choice" ? 1 - item.answer : null));
    const result = await app.complete({
      userId: "ana",
      pair: PAIR,
      level: "B1",
      recapId: entry?.id ?? "",
      seed: lesson.seed,
      answers: wrong,
    });
    expect(result.passed).toBe(false);
    expect(result.xp).toBe(0);
    expect(app.recaps.rows.find((row) => row.id === entry?.id)?.step).toBe(0);
  });
});
