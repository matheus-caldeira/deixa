import { AppError, isAppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { CardDraft } from "../domain/learning";
import type { GeneratedDrafts } from "./generate-card-drafts";
import type { LearningRepository } from "./ports";

export const CARD_BATCH_TIMEOUT_MS = 4 * 60 * 1000;
const GENERIC_FAILURE = "Não foi possível gerar os cards. Tente de novo.";
const TIMEOUT_FAILURE = "A geração demorou demais e foi interrompida. Tente de novo.";

export type CardBatchState =
  | { status: "PENDING"; batchId: string; episodeId: string }
  | { status: "FAILED"; batchId: string; episodeId: string; message: string }
  | {
      status: "DRAFT";
      batchId: string;
      episodeId: string;
      drafts: CardDraft[];
      translationsFromSubtitle: number;
      simulated: boolean;
    }
  | { status: "SAVED"; batchId: string; episodeId: string };

type Notify = (input: {
  userId: string;
  kind: "cards_ready" | "cards_failed";
  title: string;
  body: string;
  href: string;
}) => Promise<void>;

type Generate = (input: {
  userId: string;
  episodeId: string;
  learnerLevel: CefrLevel;
  batchId?: string;
}) => Promise<GeneratedDrafts>;

export function makeRequestCardDrafts(deps: {
  learning: LearningRepository;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function requestCardDrafts(input: {
    userId: string;
    episodeId: string;
  }): Promise<{ batchId: string }> {
    const batchId = deps.ids.next();
    await deps.learning.createPendingBatch({
      id: batchId,
      userId: input.userId,
      episodeId: input.episodeId,
      now: deps.clock.now(),
    });
    return { batchId };
  };
}

export function makeProcessCardBatch(deps: {
  learning: LearningRepository;
  generate: Generate;
  notify: Notify;
}) {
  return async function processCardBatch(input: {
    userId: string;
    episodeId: string;
    batchId: string;
    learnerLevel: CefrLevel;
    episodeLabel: string;
  }): Promise<void> {
    const href = `/read/${input.episodeId}?batch=${input.batchId}`;
    try {
      const generated = await deps.generate(input);
      await deps.notify({
        userId: input.userId,
        kind: "cards_ready",
        title: "Seus cards estão prontos",
        body: `${generated.drafts.length} cards de ${input.episodeLabel}. Revise e escolha quais vão para a revisão.`,
        href,
      });
    } catch (error) {
      const message = isAppError(error) && error.message !== error.code ? error.message : GENERIC_FAILURE;
      await deps.learning.failBatch(input.batchId, message);
      await deps.notify({
        userId: input.userId,
        kind: "cards_failed",
        title: "Não deu para gerar seus cards",
        body: `${input.episodeLabel}: ${message}`,
        href: `/read/${input.episodeId}`,
      });
    }
  };
}

export function makeGetCardBatch(deps: { learning: LearningRepository; clock: Clock }) {
  return async function getCardBatch(userId: string, batchId: string): Promise<CardBatchState> {
    const batch = await deps.learning.getDraftBatch(userId, batchId);
    if (!batch) throw new AppError("BATCH_NOT_FOUND");
    const base = { batchId: batch.id, episodeId: batch.episodeId };
    if (batch.status === "FAILED")
      return { ...base, status: "FAILED", message: batch.failureReason ?? GENERIC_FAILURE };
    if (batch.status === "SAVED") return { ...base, status: "SAVED" };
    if (batch.status === "PENDING") {
      const stale = deps.clock.now().getTime() - batch.createdAt.getTime() > CARD_BATCH_TIMEOUT_MS;
      return stale ? { ...base, status: "FAILED", message: TIMEOUT_FAILURE } : { ...base, status: "PENDING" };
    }
    return {
      ...base,
      status: "DRAFT",
      drafts: batch.drafts,
      translationsFromSubtitle: batch.drafts.filter((draft) => draft.lineTranslationSource === "subtitle_pt")
        .length,
      simulated: batch.llmProvider === "fake",
    };
  };
}
