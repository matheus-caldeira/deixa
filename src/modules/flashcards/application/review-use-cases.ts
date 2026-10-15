import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { startOfLocalDay } from "@/shared/time";
import type { LanguagePair } from "@/shared/study-languages";
import { ANTICIPATION_BATCH, anticipationStatus, type AnticipationStatus } from "../domain/anticipation";
import { REVIEW_XP, previewIntervals, review, type Interval, type Rating } from "../domain/schedule";
import type { CardRepository, DueCardRecord } from "./ports";

const SESSION_LIMIT = 20;

export type DueCard = Omit<DueCardRecord, "state"> & { intervals: Record<Rating, Interval> };

export type ReviewQueue = { cards: DueCard[]; dueCount: number };

type Deps = {
  cards: CardRepository;
  clock: Clock;
  ids: IdGenerator;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
};

export function makeAddCards(deps: Pick<Deps, "cards" | "clock" | "ids">) {
  return async function addCards(
    userId: string,
    cards: { learningItemId: string; sourceKind: string }[],
  ): Promise<number> {
    if (cards.length === 0) return 0;
    return deps.cards.addCards(
      userId,
      cards.map((card) => ({ id: deps.ids.next(), ...card })),
      deps.clock.now(),
    );
  };
}

export function makeListDueCards(deps: Pick<Deps, "cards" | "clock">) {
  return async function listDueCards(userId: string, pair: LanguagePair): Promise<ReviewQueue> {
    const now = deps.clock.now();
    const [records, dueCount] = await Promise.all([
      deps.cards.listDue(userId, now, SESSION_LIMIT, pair),
      deps.cards.countDue(userId, now, pair),
    ]);
    return {
      dueCount,
      cards: records.map(({ state, ...card }) => ({
        ...card,
        intervals: previewIntervals(state),
      })),
    };
  };
}

export function makeCountDueCards(deps: Pick<Deps, "cards" | "clock">) {
  return async function countDueCards(userId: string, pair: LanguagePair): Promise<number> {
    return deps.cards.countDue(userId, deps.clock.now(), pair);
  };
}

export function makeGradeCard(deps: Deps) {
  return async function gradeCard(input: {
    userId: string;
    cardId: string;
    pair: LanguagePair;
    rating: Rating;
    responseTimeMs?: number;
  }): Promise<{ dueCount: number; xpAwarded: number }> {
    const current = await deps.cards.findState(input.userId, input.cardId);
    if (!current) throw new AppError("CARD_NOT_FOUND");
    const now = deps.clock.now();
    const { state, dueInMs } = review(current, input.rating);
    const logId = deps.ids.next();
    await deps.cards.saveReview({
      userId: input.userId,
      cardId: input.cardId,
      state,
      dueAt: new Date(now.getTime() + dueInMs),
      log: { id: logId, rating: input.rating, responseTimeMs: input.responseTimeMs ?? null, reviewedAt: now },
    });
    await deps.awardXp({ userId: input.userId, source: "review", sourceId: logId, amount: REVIEW_XP });
    return { dueCount: await deps.cards.countDue(input.userId, now, input.pair), xpAwarded: REVIEW_XP };
  };
}

export function makeGetAnticipationStatus(deps: Pick<Deps, "cards" | "clock">) {
  return async function getAnticipationStatus(
    userId: string,
    timezone: string,
    pair: LanguagePair,
  ): Promise<AnticipationStatus> {
    const now = deps.clock.now();
    const [anticipationsToday, upcoming] = await Promise.all([
      deps.cards.listAnticipations(userId, startOfLocalDay(now, timezone)),
      deps.cards.countUpcoming(userId, now, pair),
    ]);
    return anticipationStatus({ usedToday: anticipationsToday.length, upcoming });
  };
}

export function makeAnticipateReview(deps: Pick<Deps, "cards" | "clock" | "ids">) {
  return async function anticipateReview(userId: string, pair: LanguagePair): Promise<{ moved: number }> {
    const now = deps.clock.now();
    const moved = await deps.cards.pullSoonestForward(userId, now, ANTICIPATION_BATCH, pair);
    if (moved === 0) throw new AppError("INVALID_INPUT", "nothingToAnticipate");
    await deps.cards.recordAnticipation({ id: deps.ids.next(), userId, cardsMoved: moved, createdAt: now });
    return { moved };
  };
}
