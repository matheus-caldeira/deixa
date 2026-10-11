import { and, asc, eq, isNotNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import {
  highlightCardBatches,
  learningItemExplanations,
  learningItems,
} from "@/infrastructure/database/schema";
import { isCefrLevel } from "@/shared/levels";
import { normalizeTerm } from "@/shared/text";
import {
  ITEM_TYPES,
  cardDraftSchema,
  type CardDraft,
  type CardScope,
  type ItemType,
  type ReusableItem,
  type TranslationSource,
} from "../domain/learning";
import type {
  CatalogSuggestion,
  DraftBatch,
  LearningRepository,
  NewLearningItem,
} from "../application/ports";

const LOCALE = "pt-BR";
const ORIGIN_HIGHLIGHT = "user_highlight";
const BATCH_STATUSES = ["PENDING", "DRAFT", "SAVED", "FAILED"] as const;

const toItemType = (value: string): ItemType => ITEM_TYPES.find((type) => type === value) ?? "expression";
const toSource = (value: string | null): TranslationSource =>
  value === "subtitle_pt" ? "subtitle_pt" : "llm";

export class DrizzleLearningRepository implements LearningRepository {
  constructor(private readonly db: Database) {}

  async findReusable(userId: string, episodeId: string): Promise<ReusableItem[]> {
    const rows = await this.db
      .select({ item: learningItems, explanation: learningItemExplanations })
      .from(learningItems)
      .innerJoin(
        learningItemExplanations,
        and(
          eq(learningItemExplanations.learningItemId, learningItems.id),
          eq(learningItemExplanations.locale, LOCALE),
        ),
      )
      .where(
        and(
          eq(learningItems.episodeId, episodeId),
          eq(learningItems.origin, ORIGIN_HIGHLIGHT),
          eq(learningItems.status, "ACTIVE"),
          isNotNull(learningItems.cueId),
          or(eq(learningItems.visibility, "global"), eq(learningItems.ownerUserId, userId)),
        ),
      )
      .orderBy(asc(learningItems.visibility), asc(learningItems.createdAt));
    return rows.flatMap(({ item, explanation }) => {
      if (item.cueId === null || item.startToken === null || item.endToken === null) return [];
      return [
        {
          id: item.id,
          cueId: item.cueId,
          startToken: item.startToken,
          endToken: item.endToken,
          visibility: item.visibility === "global" ? ("global" as const) : ("private" as const),
          ownerUserId: item.ownerUserId,
          term: item.sourceText,
          itemType: toItemType(item.itemType),
          difficulty: isCefrLevel(item.difficulty) ? item.difficulty : "B1",
          meaning: explanation.translation,
          meaningSource: toSource(explanation.translationSource),
          pronunciation: explanation.pronunciationGuide,
          exampleEnglish: explanation.exampleEnglish,
          examplePortuguese: explanation.examplePortuguese,
          lineTranslation: explanation.contextTranslation,
          lineTranslationSource: explanation.contextTranslation
            ? toSource(explanation.contextTranslationSource)
            : null,
        },
      ];
    });
  }

  async createItem(item: NewLearningItem): Promise<void> {
    const draft = item.draft;
    await this.db.transaction(async (tx) => {
      await tx.insert(learningItems).values({
        id: item.id,
        episodeId: item.episodeId,
        cueId: draft.cueId,
        startToken: draft.startToken,
        endToken: draft.endToken,
        startMs: draft.startMs,
        endMs: draft.endMs,
        sourceText: draft.term,
        normalizedText: normalizeTerm(draft.term),
        contextText: draft.lineText,
        difficulty: draft.difficulty,
        itemType: draft.itemType,
        origin: ORIGIN_HIGHLIGHT,
        visibility: item.visibility,
        ownerUserId: item.ownerUserId,
        status: "ACTIVE",
        createdAt: item.createdAt,
      });
      await tx.insert(learningItemExplanations).values({
        learningItemId: item.id,
        locale: LOCALE,
        translation: draft.meaning,
        translationSource: draft.meaningSource,
        contextTranslation: draft.lineTranslation,
        contextTranslationSource: draft.lineTranslationSource,
        pronunciationGuide: draft.pronunciation,
        exampleEnglish: draft.exampleEnglish,
        examplePortuguese: draft.examplePortuguese,
      });
    });
  }

  async promoteToGlobal(userId: string, itemId: string): Promise<void> {
    await this.db
      .update(learningItems)
      .set({ visibility: "global", ownerUserId: null })
      .where(and(eq(learningItems.id, itemId), eq(learningItems.ownerUserId, userId)));
  }

  async saveDraftBatch(batch: {
    id: string;
    userId: string;
    episodeId: string;
    drafts: CardDraft[];
    highlightsCount: number;
    llmCalls: number;
    llmProvider: string;
    now: Date;
  }): Promise<void> {
    const values = {
      status: "DRAFT",
      highlightsCount: batch.highlightsCount,
      llmCalls: batch.llmCalls,
      llmProvider: batch.llmProvider,
      draft: batch.drafts,
    };
    await this.db
      .insert(highlightCardBatches)
      .values({
        id: batch.id,
        userId: batch.userId,
        episodeId: batch.episodeId,
        cardsCreated: 0,
        createdAt: batch.now,
        ...values,
      })
      .onConflictDoUpdate({
        target: highlightCardBatches.id,
        set: values,
        setWhere: and(
          eq(highlightCardBatches.userId, batch.userId),
          eq(highlightCardBatches.status, "PENDING"),
        ),
      });
  }

  async createPendingBatch(batch: {
    id: string;
    userId: string;
    episodeId: string;
    now: Date;
  }): Promise<void> {
    await this.db.insert(highlightCardBatches).values({
      id: batch.id,
      userId: batch.userId,
      episodeId: batch.episodeId,
      status: "PENDING",
      highlightsCount: 0,
      cardsCreated: 0,
      llmCalls: 0,
      llmProvider: "nenhum",
      draft: [],
      createdAt: batch.now,
    });
  }

  async failBatch(batchId: string, reason: string): Promise<void> {
    await this.db
      .update(highlightCardBatches)
      .set({ status: "FAILED", failureReason: reason.slice(0, 300) })
      .where(and(eq(highlightCardBatches.id, batchId), eq(highlightCardBatches.status, "PENDING")));
  }

  async getDraftBatch(userId: string, batchId: string): Promise<DraftBatch | null> {
    if (!z.uuid().safeParse(batchId).success) return null;
    const [row] = await this.db
      .select()
      .from(highlightCardBatches)
      .where(and(eq(highlightCardBatches.id, batchId), eq(highlightCardBatches.userId, userId)))
      .limit(1);
    if (!row) return null;
    const drafts = z.array(cardDraftSchema).safeParse(row.draft);
    return {
      id: row.id,
      episodeId: row.episodeId,
      status: BATCH_STATUSES.find((status) => status === row.status) ?? "FAILED",
      drafts: drafts.success ? drafts.data : [],
      llmProvider: row.llmProvider,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
    };
  }

  async markBatchSaved(input: {
    userId: string;
    batchId: string;
    scope: CardScope;
    cardsCreated: number;
  }): Promise<void> {
    await this.db
      .update(highlightCardBatches)
      .set({ status: "SAVED", shareScope: input.scope, cardsCreated: input.cardsCreated })
      .where(and(eq(highlightCardBatches.id, input.batchId), eq(highlightCardBatches.userId, input.userId)));
  }

  async listGlobalSuggestions(episodeId: string): Promise<CatalogSuggestion[]> {
    const rows = await this.db
      .select({
        itemId: learningItems.id,
        cueId: learningItems.cueId,
        startToken: learningItems.startToken,
        endToken: learningItems.endToken,
        term: learningItems.sourceText,
      })
      .from(learningItems)
      .where(
        and(
          eq(learningItems.episodeId, episodeId),
          eq(learningItems.origin, ORIGIN_HIGHLIGHT),
          eq(learningItems.visibility, "global"),
          eq(learningItems.status, "ACTIVE"),
          ne(learningItems.itemType, "sentence"),
          isNotNull(learningItems.cueId),
        ),
      );
    return rows.flatMap((row) =>
      row.cueId === null || row.startToken === null || row.endToken === null
        ? []
        : [{ ...row, cueId: row.cueId, startToken: row.startToken, endToken: row.endToken }],
    );
  }

  async findSpeakableText(userId: string, itemId: string): Promise<string | null> {
    if (!z.uuid().safeParse(itemId).success) return null;
    const [row] = await this.db
      .select({ text: learningItems.sourceText })
      .from(learningItems)
      .where(
        and(
          eq(learningItems.id, itemId),
          or(eq(learningItems.visibility, "global"), eq(learningItems.ownerUserId, userId)),
        ),
      )
      .limit(1);
    return row?.text ?? null;
  }
}
