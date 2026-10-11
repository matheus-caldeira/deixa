import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { NEW_CARD_STATE, formatInterval, previewIntervals, review } from "../domain/schedule";
import {
  makeAddCards,
  makeAnticipateReview,
  makeCountDueCards,
  makeGetAnticipationStatus,
  makeGradeCard,
  makeListDueCards,
  sourceLabelOf,
} from "./review-use-cases";
import { InMemoryCards } from "./testing/fakes";

const DAY = 24 * 60 * 60 * 1000;

describe("agendamento da revisão", () => {
  it("mostra o próximo intervalo de cada nota para um card novo", () => {
    expect(previewIntervals(NEW_CARD_STATE)).toEqual({
      again: "<10 min",
      hard: "1 dia",
      good: "3 dias",
      easy: "7 dias",
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
    expect(formatInterval(5 * 60 * 1000)).toBe("<10 min");
    expect(formatInterval(DAY)).toBe("1 dia");
    expect(formatInterval(12 * DAY)).toBe("12 dias");
    expect(formatInterval(31 * DAY)).toBe("1 mês");
    expect(formatInterval(95 * DAY)).toBe("3 meses");
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
      sourceLabel: "How I Met Your Mother · T1 · E3 · suas marcações",
      intervals: { again: "<10 min", hard: "1 dia", good: "3 dias", easy: "7 dias" },
    });
    expect((await app.listDue("lucas")).cards[0]?.sourceLabel).toBe(
      "How I Met Your Mother · T1 · E3 · catálogo",
    );
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

  it("monta a origem do card para filme e para item sem episódio", () => {
    const base = (await0: Partial<Parameters<typeof sourceLabelOf>[0]>) =>
      sourceLabelOf({
        cardId: "c",
        learningItemId: "i",
        term: "t",
        meaning: "m",
        meaningSource: "llm",
        itemType: "word",
        contextText: null,
        contextTranslation: null,
        pronunciation: null,
        mediaTitle: "The Devil Wears Prada",
        mediaType: "movie",
        seasonNumber: 0,
        episodeNumber: 1,
        sourceKind: "curated",
        state: NEW_CARD_STATE,
        ...await0,
      });
    expect(base({})).toBe("The Devil Wears Prada · filme");
    expect(base({ mediaTitle: null, mediaType: null, seasonNumber: null, episodeNumber: null })).toBe(
      "Revisão",
    );
  });

  it("antecipa a próxima revisão: traz os cartões mais próximos e a espera cresce uma hora a cada uso", async () => {
    const tz = "America/Sao_Paulo";
    const items = Array.from({ length: 14 }, (_, index) => ({
      learningItemId: `item-${index}`,
      sourceKind: "curated",
    }));
    await app.addCards("ana", items);
    for (const card of (await app.listDue("ana")).cards)
      await app.grade({ userId: "ana", cardId: card.cardId, rating: "good" });
    expect(await app.countDue("ana")).toBe(0);
    expect(await app.status("ana", tz)).toMatchObject({
      available: true,
      upcoming: 14,
      batchSize: 10,
      usedToday: 0,
    });

    expect(await app.anticipate("ana", tz)).toEqual({ moved: 10 });
    expect(await app.countDue("ana")).toBe(10);
    const afterFirst = await app.status("ana", tz);
    expect(afterFirst).toMatchObject({ available: false, usedToday: 1, waitHours: 1, upcoming: 4 });
    expect(afterFirst.availableAt?.getTime()).toBe(app.clock.now().getTime() + 60 * 60 * 1000);
    await expect(app.anticipate("ana", tz)).rejects.toMatchObject({ code: "INVALID_INPUT" });

    app.clock.advanceMs(61 * 60 * 1000);
    expect(await app.anticipate("ana", tz)).toEqual({ moved: 4 });
    expect(await app.status("ana", tz)).toMatchObject({
      usedToday: 2,
      waitHours: 2,
      upcoming: 0,
      available: false,
    });
  });

  it("a antecipação de um usuário não mexe nos cartões do outro e tem teto diário", async () => {
    const tz = "America/Sao_Paulo";
    await app.addCards("ana", [{ learningItemId: "a", sourceKind: "curated" }]);
    await app.addCards("lucas", [{ learningItemId: "b", sourceKind: "curated" }]);
    for (const user of ["ana", "lucas"]) {
      const cardId = (await app.listDue(user)).cards[0]?.cardId ?? "";
      await app.grade({ userId: user, cardId, rating: "good" });
    }
    await app.anticipate("ana", tz);
    expect(await app.countDue("ana")).toBe(1);
    expect(await app.countDue("lucas")).toBe(0);
    expect(await app.status("lucas", tz)).toMatchObject({ usedToday: 0, available: true });
    for (let used = 1; used < 5; used += 1)
      app.cards.anticipations.push({ userId: "ana", createdAt: app.clock.now() });
    expect(await app.status("ana", tz)).toMatchObject({ usedToday: 5, available: false, availableAt: null });
  });
});
