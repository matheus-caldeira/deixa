import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { localDateKey, startOfLocalDay } from "@/shared/time";
import { ANTICIPATION_BATCH, anticipationStatus, type AnticipationStatus } from "../domain/anticipation";
import { REVIEW_XP, previewIntervals, review, type Rating } from "../domain/schedule";
import type { CardRepository, DueCardRecord } from "./ports";

const SESSION_LIMIT = 20;
const SOURCE_SUFFIX: Record<string, string> = {
  highlight_private: "suas marcações",
  highlight_catalog: "catálogo",
  lesson_error: "erros da lição",
  tutor: "conversa com o tutor",
};

export type DueCard = Omit<DueCardRecord, "state"> & {
  sourceLabel: string;
  intervals: Record<Rating, string>;
};

export type ReviewQueue = { cards: DueCard[]; dueCount: number };

type Deps = {
  cards: CardRepository;
  clock: Clock;
  ids: IdGenerator;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
};

export function sourceLabelOf(card: DueCardRecord): string {
  const episode =
    card.mediaType === "movie"
      ? "filme"
      : card.seasonNumber !== null && card.episodeNumber !== null
        ? `T${card.seasonNumber} · E${card.episodeNumber}`
        : null;
  const suffix = SOURCE_SUFFIX[card.sourceKind];
  return [card.mediaTitle, episode, suffix].filter((part) => part).join(" · ") || "Revisão";
}

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
  return async function listDueCards(userId: string): Promise<ReviewQueue> {
    const now = deps.clock.now();
    const [records, dueCount] = await Promise.all([
      deps.cards.listDue(userId, now, SESSION_LIMIT),
      deps.cards.countDue(userId, now),
    ]);
    return {
      dueCount,
      cards: records.map(({ state, ...card }) => ({
        ...card,
        sourceLabel: sourceLabelOf({ ...card, state }),
        intervals: previewIntervals(state),
      })),
    };
  };
}

export function makeCountDueCards(deps: Pick<Deps, "cards" | "clock">) {
  return async function countDueCards(userId: string): Promise<number> {
    return deps.cards.countDue(userId, deps.clock.now());
  };
}

export function makeGradeCard(deps: Deps) {
  return async function gradeCard(input: {
    userId: string;
    cardId: string;
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
    return { dueCount: await deps.cards.countDue(input.userId, now), xpAwarded: REVIEW_XP };
  };
}

export function makeGetAnticipationStatus(deps: Pick<Deps, "cards" | "clock">) {
  return async function getAnticipationStatus(userId: string, timezone: string): Promise<AnticipationStatus> {
    const now = deps.clock.now();
    const [anticipationsToday, upcoming] = await Promise.all([
      deps.cards.listAnticipations(userId, startOfLocalDay(now, timezone)),
      deps.cards.countUpcoming(userId, now),
    ]);
    return anticipationStatus({ anticipationsToday, upcoming, now });
  };
}

export function makeAnticipateReview(deps: Pick<Deps, "cards" | "clock" | "ids">) {
  const getStatus = makeGetAnticipationStatus(deps);
  return async function anticipateReview(userId: string, timezone: string): Promise<{ moved: number }> {
    const status = await getStatus(userId, timezone);
    if (!status.available) {
      throw new AppError(
        "INVALID_INPUT",
        status.upcoming === 0
          ? "Não há cartões futuros para antecipar."
          : status.availableAt
            ? "A próxima antecipação ainda não foi liberada."
            : "Você já usou todas as antecipações de hoje.",
      );
    }
    const now = deps.clock.now();
    const id = deps.ids.next();
    const claimed = await deps.cards.claimAnticipation({
      id,
      userId,
      day: localDateKey(now, timezone),
      ordinal: status.usedToday + 1,
      createdAt: now,
    });
    if (!claimed) throw new AppError("INVALID_INPUT", "Essa antecipação já foi usada. Atualize a tela.");
    const moved = await deps.cards.pullSoonestForward(userId, now, ANTICIPATION_BATCH);
    await deps.cards.setAnticipationResult(id, moved);
    return { moved };
  };
}
