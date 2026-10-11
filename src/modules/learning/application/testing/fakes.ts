import type { CardDraft, CardScope, ReusableItem, Visibility } from "../../domain/learning";
import type {
  CatalogSuggestion,
  DraftBatch,
  LearningCollaborators,
  LearningRepository,
  LlmProvider,
  NewLearningItem,
  PendingHighlight,
  ScriptLineForCards,
} from "../ports";

type StoredItem = ReusableItem & { episodeId: string };
type StoredBatch = DraftBatch & { userId: string; llmCalls: number; scope: CardScope | null };
const EPOCH = new Date("2026-10-10T12:00:00Z");

export class InMemoryLearning implements LearningRepository {
  readonly items: StoredItem[] = [];
  readonly batches: StoredBatch[] = [];

  async findReusable(userId: string, episodeId: string): Promise<ReusableItem[]> {
    return this.items
      .filter(
        (item) =>
          item.episodeId === episodeId && (item.visibility === "global" || item.ownerUserId === userId),
      )
      .map(({ episodeId: _episodeId, ...item }) => item);
  }

  async createItem(item: NewLearningItem): Promise<void> {
    const draft: CardDraft = item.draft;
    this.items.push({
      id: item.id,
      episodeId: item.episodeId,
      cueId: draft.cueId,
      startToken: draft.startToken,
      endToken: draft.endToken,
      visibility: item.visibility,
      ownerUserId: item.ownerUserId,
      term: draft.term,
      itemType: draft.itemType,
      difficulty: draft.difficulty,
      meaning: draft.meaning,
      meaningSource: draft.meaningSource,
      pronunciation: draft.pronunciation,
      exampleEnglish: draft.exampleEnglish,
      examplePortuguese: draft.examplePortuguese,
      lineTranslation: draft.lineTranslation,
      lineTranslationSource: draft.lineTranslationSource,
    });
  }

  async promoteToGlobal(userId: string, itemId: string): Promise<void> {
    const item = this.items.find((candidate) => candidate.id === itemId && candidate.ownerUserId === userId);
    if (item) {
      item.visibility = "global" satisfies Visibility;
      item.ownerUserId = null;
    }
  }

  async createPendingBatch(batch: {
    id: string;
    userId: string;
    episodeId: string;
    now: Date;
  }): Promise<void> {
    this.batches.push({
      id: batch.id,
      userId: batch.userId,
      episodeId: batch.episodeId,
      status: "PENDING",
      drafts: [],
      llmCalls: 0,
      llmProvider: "nenhum",
      failureReason: null,
      createdAt: batch.now,
      scope: null,
    });
  }

  async failBatch(batchId: string, reason: string): Promise<void> {
    const batch = this.batches.find((candidate) => candidate.id === batchId);
    if (batch && batch.status === "PENDING") {
      batch.status = "FAILED";
      batch.failureReason = reason;
    }
  }

  async saveDraftBatch(batch: {
    id: string;
    userId: string;
    episodeId: string;
    drafts: CardDraft[];
    llmCalls: number;
    llmProvider: string;
  }): Promise<void> {
    const existing = this.batches.find(
      (candidate) => candidate.id === batch.id && candidate.userId === batch.userId,
    );
    if (existing) {
      existing.status = "DRAFT";
      existing.drafts = batch.drafts;
      existing.llmCalls = batch.llmCalls;
      existing.llmProvider = batch.llmProvider;
      return;
    }
    this.batches.push({
      id: batch.id,
      userId: batch.userId,
      episodeId: batch.episodeId,
      status: "DRAFT",
      drafts: batch.drafts,
      llmCalls: batch.llmCalls,
      llmProvider: batch.llmProvider,
      failureReason: null,
      createdAt: EPOCH,
      scope: null,
    });
  }

  async getDraftBatch(userId: string, batchId: string): Promise<DraftBatch | null> {
    const batch = this.batches.find((candidate) => candidate.id === batchId && candidate.userId === userId);
    if (!batch) return null;
    const { userId: _userId, llmCalls: _llmCalls, scope: _scope, ...view } = batch;
    return view;
  }

  async markBatchSaved(input: { userId: string; batchId: string; scope: CardScope }): Promise<void> {
    const batch = this.batches.find(
      (candidate) => candidate.id === input.batchId && candidate.userId === input.userId,
    );
    if (batch) {
      batch.status = "SAVED";
      batch.scope = input.scope;
    }
  }

  async listGlobalSuggestions(episodeId: string): Promise<CatalogSuggestion[]> {
    return this.items
      .filter((item) => item.episodeId === episodeId && item.visibility === "global")
      .map((item) => ({
        itemId: item.id,
        cueId: item.cueId,
        startToken: item.startToken,
        endToken: item.endToken,
        term: item.term,
      }));
  }

  async findSpeakableText(userId: string, itemId: string): Promise<string | null> {
    const item = this.items.find(
      (candidate) =>
        candidate.id === itemId && (candidate.visibility === "global" || candidate.ownerUserId === userId),
    );
    return item?.term ?? null;
  }
}

export class CollaboratorSpy {
  readonly pending = new Map<string, PendingHighlight[]>();
  readonly cardsByUser = new Map<string, Set<string>>();
  readonly xp: { userId: string; source: string; sourceId: string; amount: number }[] = [];
  readonly carded: { userId: string; highlightIds: string[]; scope: CardScope }[] = [];

  constructor(
    private readonly lines: ScriptLineForCards[],
    private readonly llm: LlmProvider,
    private readonly episodeIds: string[] = ["ep-1"],
  ) {}

  setPending(userId: string, highlights: PendingHighlight[]): void {
    this.pending.set(userId, highlights);
  }

  collaborators(): LearningCollaborators {
    return {
      loadScript: async (episodeId) => (this.episodeIds.includes(episodeId) ? { lines: this.lines } : null),
      listPendingHighlights: async (userId) => this.pending.get(userId) ?? [],
      markHighlightsCarded: async (input) => {
        this.carded.push({ userId: input.userId, highlightIds: input.highlightIds, scope: input.scope });
        const remaining = (this.pending.get(input.userId) ?? []).filter(
          (highlight) => !input.highlightIds.includes(highlight.id),
        );
        this.pending.set(input.userId, remaining);
      },
      addCards: async (userId, cards) => {
        const owned = this.cardsByUser.get(userId) ?? new Set<string>();
        const before = owned.size;
        for (const card of cards) owned.add(card.learningItemId);
        this.cardsByUser.set(userId, owned);
        return owned.size - before;
      },
      awardXp: async (input) => {
        const duplicate = this.xp.some(
          (event) =>
            event.userId === input.userId &&
            event.source === input.source &&
            event.sourceId === input.sourceId,
        );
        if (!duplicate) this.xp.push(input);
      },
      resolveLlm: async () => this.llm,
    };
  }
}
