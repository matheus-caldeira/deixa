import type { CefrLevel } from "@/shared/levels";
import type { CardDraft, CardScope, MarkKind, ReusableItem, Visibility } from "../domain/learning";

export type ExplainRequestItem = {
  id: string;
  term: string;
  kind: MarkKind;
  lineText: string;
  lineTranslation: string | null;
};

export type ExplainRequest = { learnerLevel: CefrLevel; items: ExplainRequestItem[] };
export type LlmProviderName = "gemini" | "fake";

export interface LlmProvider {
  readonly name: LlmProviderName;
  explainTerms(request: ExplainRequest): Promise<unknown>;
  translateLines(lines: { id: string; text: string }[]): Promise<unknown>;
}

export type ResolveLlm = (userId: string) => Promise<LlmProvider>;

export type NewLearningItem = {
  id: string;
  episodeId: string;
  draft: CardDraft;
  visibility: Visibility;
  ownerUserId: string | null;
  createdAt: Date;
};

export type DraftBatch = {
  id: string;
  episodeId: string;
  status: "PENDING" | "DRAFT" | "SAVED" | "FAILED";
  drafts: CardDraft[];
  llmProvider: string;
  failureReason: string | null;
  createdAt: Date;
};

export type CatalogSuggestion = {
  itemId: string;
  cueId: string;
  startToken: number;
  endToken: number;
  term: string;
};

export interface LearningRepository {
  findReusable(userId: string, episodeId: string): Promise<ReusableItem[]>;
  createItem(item: NewLearningItem): Promise<void>;
  promoteToGlobal(userId: string, itemId: string): Promise<void>;
  saveDraftBatch(batch: {
    id: string;
    userId: string;
    episodeId: string;
    drafts: CardDraft[];
    highlightsCount: number;
    llmCalls: number;
    llmProvider: string;
    now: Date;
  }): Promise<void>;
  createPendingBatch(batch: { id: string; userId: string; episodeId: string; now: Date }): Promise<void>;
  failBatch(batchId: string, reason: string): Promise<void>;
  getDraftBatch(userId: string, batchId: string): Promise<DraftBatch | null>;
  markBatchSaved(input: {
    userId: string;
    batchId: string;
    scope: CardScope;
    cardsCreated: number;
  }): Promise<void>;
  listGlobalSuggestions(episodeId: string): Promise<CatalogSuggestion[]>;
  findSpeakableText(userId: string, itemId: string): Promise<string | null>;
}

export type ScriptLineForCards = {
  cueId: string;
  text: string;
  startMs: number;
  endMs: number;
  translation: string | null;
  translationSource: "subtitle_pt" | "llm" | null;
};

export type PendingHighlight = {
  id: string;
  cueId: string;
  startToken: number;
  endToken: number;
  kind: MarkKind;
};

export type LearningCollaborators = {
  loadScript: (episodeId: string) => Promise<{ lines: ScriptLineForCards[] } | null>;
  listPendingHighlights: (userId: string, episodeId: string) => Promise<PendingHighlight[]>;
  markHighlightsCarded: (input: {
    userId: string;
    episodeId: string;
    highlightIds: string[];
    batchId: string;
    scope: CardScope;
  }) => Promise<void>;
  addCards: (userId: string, cards: { learningItemId: string; sourceKind: string }[]) => Promise<number>;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  resolveLlm: ResolveLlm;
};
