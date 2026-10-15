import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { NEW_CARD_STATE, intervalOf, previewIntervals, review } from "../domain/schedule";
import {
  makeAddCards,
  makeAnticipateReview,
  makeCountDueCards,
  makeGetAnticipationStatus,
  makeGradeCard,
  makeListDueCards,
} from "./review-use-cases";
import { InMemoryCards } from "./testing/fakes";

const DAY = 24 * 60 * 60 * 1000;

describe("agendamento da revisão", () => {
  it("mostra o próximo intervalo de cada nota para um card novo", () => {
    expect(previewIntervals(NEW_CARD_STATE)).toEqual({
      again: { unit: "minutes", value: 10 },
      hard: { unit: "days", value: 1 },
      good: { unit: "days", value: 3 },
      easy: { unit: "days", value: 7 },
    });
  });

  it("cresce o intervalo com acertos e zera a sequência em De novo", () => {
    const first = review(NEW_CARD_STATE, "good");
    expect(first.state).toMatchObject({ intervalDays: 3, repetitions: 1, lapses: 0 });
    const second = review(first.state, "good");
    expect(second.state.intervalDays).toBe(8);
    expect(second.dueInMs).toBe(8 * DAY);
    const easy = review(second.state, "easy");
    expect(easy.state.intervalDays).toBeGreaterThan(second.state.intervalDays * 2);

    const lapse = review(second.state, "again");
    expect(lapse.state).toMatchObject({ intervalDays: 0, repetitions: 0, lapses: 1 });
    expect(lapse.dueInMs).toBe(10 * 60 * 1000);
    expect(lapse.state.difficulty).toBeLessThan(second.state.difficulty);
    expect(review(lapse.state, "good").state.intervalDays).toBe(3);
  });

  it("Difícil sempre avança ao menos um dia e a facilidade tem piso e teto", () => {
    const hard = review({ ...NEW_CARD_STATE, intervalDays: 1, repetitions: 1 }, "hard");
    expect(hard.state.intervalDays).toBe(2);
    let state = NEW_CARD_STATE;
    for (let round = 0; round < 20; round += 1) state = review(state, "again").state;
    expect(state.difficulty).toBe(1.3);
    for (let round = 0; round < 20; round += 1) state = review(state, "easy").state;
    expect(state.difficulty).toBe(3);
  });

  it("formata intervalos em português", () => {
    expect(intervalOf(5 * 60 * 1000)).toEqual({ unit: "minutes", value: 10 });
    expect(intervalOf(DAY)).toEqual({ unit: "days", value: 1 });
    expect(intervalOf(12 * DAY)).toEqual({ unit: "days", value: 12 });
    expect(intervalOf(31 * DAY)).toEqual({ unit: "months", value: 1 });
    expect(intervalOf(95 * DAY)).toEqual({ unit: "months", value: 3 });
  });
});

function setup() {
  const cards = new InMemoryCards();
  const clock = new FixedClock("2026-10-10T12:00:00Z");
  const xp: { userId: string; source: string; amount: number }[] = [];
  const deps = {
    cards,
    clock,
    ids: new SequentialIds("card"),
    awardXp: async (input: { userId: string; source: string; sourceId: string; amount: number }) => {
      xp.push({ userId: input.userId, source: input.source, amount: input.amount });
    },
  };
  return {
    cards,
    clock,
    xp,
    addCards: makeAddCards(deps),
    listDue: makeListDueCards(deps),
    countDue: makeCountDueCards(deps),
    grade: makeGradeCard(deps),
    status: makeGetAnticipationStatus(deps),
    anticipate: makeAnticipateReview(deps),
  };
}

describe("fila de revisão", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("cria o card vencendo agora e não duplica o mesmo item para o mesmo usuário", async () => {
    expect(await app.addCards("ana", [{ learningItemId: "item-1", sourceKind: "highlight_private" }])).toBe(
      1,
    );
    expect(await app.addCards("ana", [{ learningItemId: "item-1", sourceKind: "highlight_private" }])).toBe(
      0,
    );
    expect(await app.addCards("lucas", [{ learningItemId: "item-1", sourceKind: "highlight_catalog" }])).toBe(
      1,
    );
    const queue = await app.listDue("ana");
    expect(queue.dueCount).toBe(1);
    expect(queue.cards[0]).toMatchObject({
      mediaTitle: "How I Met Your Mother",
      seasonNumber: 1,
      episodeNumber: 3,
      sourceKind: "highlight_private",
      intervals: {
        again: { unit: "minutes", value: 10 },
        hard: { unit: "days", value: 1 },
        good: { unit: "days", value: 3 },
        easy: { unit: "days", value: 7 },
      },
    });
    expect((await app.listDue("lucas")).cards[0]?.sourceKind).toBe("highlight_catalog");
  });

  it("agenda a próxima revisão, registra o histórico e rende XP", async () => {
    await app.addCards("ana", [{ learningItemId: "item-1", sourceKind: "highlight_private" }]);
    const cardId = (await app.listDue("ana")).cards[0]?.cardId ?? "";
    const result = await app.grade({ userId: "ana", cardId, rating: "good" });
    expect(result).toEqual({ dueCount: 0, xpAwarded: 2 });
    expect(app.cards.logs).toMatchObject([{ cardId, rating: "good" }]);
    expect(app.xp).toEqual([{ userId: "ana", source: "review", amount: 2 }]);

    app.clock.advanceDays(2);
    expect(await app.countDue("ana")).toBe(0);
    app.clock.advanceDays(1);
    expect(await app.countDue("ana")).toBe(1);
  });

  it("De novo traz o card de volta em minutos", async () => {
    await app.addCards("ana", [{ learningItemId: "item-1", sourceKind: "highlight_private" }]);
    const cardId = (await app.listDue("ana")).cards[0]?.cardId ?? "";
    await app.grade({ userId: "ana", cardId, rating: "again" });
    expect(await app.countDue("ana")).toBe(0);
    app.clock.advanceMs(11 * 60 * 1000);
    expect(await app.countDue("ana")).toBe(1);
  });

  it("um usuário não vê nem avalia o card do outro", async () => {
    await app.addCards("ana", [{ learningItemId: "item-1", sourceKind: "highlight_private" }]);
    const anaCardId = (await app.listDue("ana")).cards[0]?.cardId ?? "";
    expect((await app.listDue("lucas")).cards).toEqual([]);
    await expect(app.grade({ userId: "lucas", cardId: anaCardId, rating: "easy" })).rejects.toMatchObject({
      code: "CARD_NOT_FOUND",
    });
    expect(await app.countDue("ana")).toBe(1);
    expect(app.xp).toEqual([]);
  });

  it("antecipa a próxima revisão quantas vezes quiser, sempre trazendo os cartões mais próximos", async () => {
    const tz = "America/Sao_Paulo";
    const items = Array.from({ length: 24 }, (_, index) => ({
      learningItemId: `item-${index}`,
      sourceKind: "curated",
    }));
    await app.addCards("ana", items);
    for (let round = 0; round < 2; round += 1) {
      for (const card of (await app.listDue("ana")).cards)
        await app.grade({ userId: "ana", cardId: card.cardId, rating: "good" });
    }
    expect(await app.countDue("ana")).toBe(0);
    expect(await app.status("ana", tz)).toMatchObject({
      available: true,
      upcoming: 24,
      batchSize: 10,
      usedToday: 0,
    });

    for (const expected of [10, 10, 4]) {
      expect(await app.anticipate("ana")).toEqual({ moved: expected });
    }
    expect(await app.countDue("ana")).toBe(24);
    expect(await app.status("ana", tz)).toMatchObject({ usedToday: 3, upcoming: 0, available: false });
    await expect(app.anticipate("ana")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("a antecipação de um usuário não mexe nos cartões do outro", async () => {
    await app.addCards("ana", [{ learningItemId: "a", sourceKind: "curated" }]);
    await app.addCards("lucas", [{ learningItemId: "b", sourceKind: "curated" }]);
    for (const user of ["ana", "lucas"]) {
      const cardId = (await app.listDue(user)).cards[0]?.cardId ?? "";
      await app.grade({ userId: user, cardId, rating: "good" });
    }
    await app.anticipate("ana");
    expect(await app.countDue("ana")).toBe(1);
    expect(await app.countDue("lucas")).toBe(0);
  });
});
