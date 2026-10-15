import type { LanguagePair, StudyLanguage } from "@/shared/study-languages";
import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { HIGHLIGHT_CARDS_XP, spanKeyOf, type CardScope } from "../domain/learning";
import type { LearningCollaborators, LearningRepository } from "./ports";

type Deps = Pick<LearningCollaborators, "markHighlightsCarded" | "addCards" | "awardXp"> & {
  learning: LearningRepository;
  clock: Clock;
  ids: IdGenerator;
};

export type ConfirmedBatch = { cardsCreated: number; cardsKept: number; xpAwarded: number; scope: CardScope };

export function makeConfirmCardBatch(deps: Deps) {
  return async function confirmCardBatch(input: {
    userId: string;
    batchId: string;
    pair: LanguagePair;
    keepKeys: string[];
    scope: CardScope;
  }): Promise<ConfirmedBatch> {
    const batch = await deps.learning.getDraftBatch(input.userId, input.batchId);
    if (!batch || batch.status !== "DRAFT") throw new AppError("BATCH_NOT_FOUND");
    const keep = new Set(input.keepKeys);
    const kept = batch.drafts.filter((draft) => keep.has(draft.key));
    if (kept.length === 0) throw new AppError("NO_HIGHLIGHTS");

    const visibility = input.scope === "catalog" ? "global" : "private";
    const reusable = new Map(
      (await deps.learning.findReusable(input.userId, batch.episodeId, input.pair)).map((item) => [
        spanKeyOf(item),
        item,
      ]),
    );
    const now = deps.clock.now();
    const itemIds: string[] = [];
    for (const draft of kept) {
      const existing = reusable.get(spanKeyOf(draft));
      if (existing) {
        if (existing.visibility === "private" && input.scope === "catalog") {
          await deps.learning.promoteToGlobal(input.userId, existing.id);
        }
        itemIds.push(existing.id);
        continue;
      }
      const id = deps.ids.next();
      await deps.learning.createItem({
        id,
        episodeId: batch.episodeId,
        pair: input.pair,
        draft,
        visibility,
        ownerUserId: visibility === "private" ? input.userId : null,
        createdAt: now,
      });
      itemIds.push(id);
    }

    const sourceKind = input.scope === "catalog" ? "highlight_catalog" : "highlight_private";
    const cardsCreated = await deps.addCards(
      input.userId,
      itemIds.map((learningItemId) => ({ learningItemId, sourceKind })),
    );
    await deps.markHighlightsCarded({
      userId: input.userId,
      episodeId: batch.episodeId,
      highlightIds: kept.map((draft) => draft.highlightId),
      batchId: batch.id,
      scope: input.scope,
    });
    await deps.awardXp({
      userId: input.userId,
      source: "highlight_cards",
      sourceId: batch.id,
      amount: HIGHLIGHT_CARDS_XP,
    });
    await deps.learning.markBatchSaved({
      userId: input.userId,
      batchId: batch.id,
      scope: input.scope,
      cardsCreated,
    });
    return { cardsCreated, cardsKept: kept.length, xpAwarded: HIGHLIGHT_CARDS_XP, scope: input.scope };
  };
}

export function makeListCatalogSuggestions(deps: { learning: LearningRepository }) {
  return async function listCatalogSuggestions(episodeId: string, language: StudyLanguage) {
    return deps.learning.listGlobalSuggestions(episodeId, language);
  };
}

export function makeGetSpeakableItem(deps: { learning: LearningRepository }) {
  return async function getSpeakableItem(
    userId: string,
    itemId: string,
  ): Promise<{ text: string; language: StudyLanguage }> {
    const found = await deps.learning.findSpeakable(userId, itemId);
    if (!found) throw new AppError("ITEM_NOT_FOUND");
    return found;
  };
}
