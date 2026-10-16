import type { StudyLanguage } from "@/shared/study-languages";
import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import {
  MAX_USER_TURNS,
  THEMES,
  conversationAnalysisSchema,
  reviewFromAnalysis,
  resolveTheme,
  tutorReplySchema,
  type ConversationReview,
  type Correction,
  type ReviewStatus,
  type Session,
  type Turn,
} from "../domain/conversation";
import { FakeTutorProvider } from "../infrastructure/fake-tutor-provider";
import {
  makeGetConversation,
  makeGetLearnerProfile,
  makeGetTurnSpeechText,
  makeCloseConversation,
  makeConfirmConversationCards,
  makeListConversations,
  makeRequestConversationReview,
  makeRequestTermCards,
  makeRunConversationReview,
  makeRunTermCards,
  makeSendMessage,
  makeStartConversation,
  type CardPlacement,
  type ConversationNotification,
  type ConversationRepository,
  type NewCard,
  type TutorProvider,
} from "./conversation-use-cases";

class InMemoryConversations implements ConversationRepository {
  readonly sessions: (Session & { userId: string })[] = [];
  readonly turns: (Turn & { sessionId: string })[] = [];

  async createSession(input: {
    id: string;
    userId: string;
    themeId: string;
    themeTitle: string;
    level: CefrLevel;
    language: StudyLanguage;
    now: Date;
  }) {
    this.sessions.push({
      id: input.id,
      language: input.language,
      userId: input.userId,
      themeId: input.themeId,
      themeTitle: input.themeTitle,
      level: input.level,
      review: null,
      reviewStatus: "none",
      closedAt: null,
      cardsConfirmedAt: null,
      createdAt: input.now,
    });
  }

  async findSession(userId: string, sessionId: string) {
    const found = this.sessions.find((session) => session.id === sessionId && session.userId === userId);
    if (!found) return null;
    const { userId: _userId, ...session } = found;
    return session;
  }

  async listSessions(userId: string, language: StudyLanguage, limit: number) {
    return this.sessions
      .filter((session) => session.userId === userId && session.language === language)
      .slice(-limit)
      .map(({ userId: _userId, ...session }) => ({
        ...session,
        turnCount: this.turns.filter((turn) => turn.sessionId === session.id).length,
      }));
  }

  async addTurn(input: {
    id: string;
    sessionId: string;
    role: Turn["role"];
    text: string;
    translation: string | null;
    corrections: Correction[];
    now: Date;
  }) {
    this.turns.push({
      id: input.id,
      sessionId: input.sessionId,
      role: input.role,
      text: input.text,
      translation: input.translation,
      corrections: input.corrections,
      correctedText: null,
      createdAt: input.now,
    });
  }

  async listTurns(sessionId: string) {
    return this.turns
      .filter((turn) => turn.sessionId === sessionId)
      .map(({ sessionId: _sessionId, ...turn }) => turn);
  }

  readonly used = new Map<string, number>();

  async claimUserTurn(userId: string, sessionId: string, max: number) {
    if (!this.sessions.some((session) => session.id === sessionId && session.userId === userId)) return false;
    const current = this.used.get(sessionId) ?? 0;
    if (current >= max) return false;
    this.used.set(sessionId, current + 1);
    return true;
  }

  async releaseUserTurn(_userId: string, sessionId: string) {
    this.used.set(sessionId, Math.max(0, (this.used.get(sessionId) ?? 0) - 1));
  }

  private owned(userId: string, sessionId: string) {
    return this.sessions.find((candidate) => candidate.id === sessionId && candidate.userId === userId);
  }

  async closeSession(userId: string, sessionId: string, reviewStatus: ReviewStatus, now: Date) {
    const session = this.owned(userId, sessionId);
    if (!session || session.closedAt) return false;
    session.closedAt = now;
    session.reviewStatus = reviewStatus;
    return true;
  }

  async queueReview(userId: string, sessionId: string) {
    const session = this.owned(userId, sessionId);
    if (!session?.closedAt || !["none", "failed"].includes(session.reviewStatus)) return false;
    session.reviewStatus = "queued";
    return true;
  }

  async markReviewRunning(userId: string, sessionId: string) {
    const session = this.owned(userId, sessionId);
    if (!session || !["queued", "running"].includes(session.reviewStatus)) return false;
    session.reviewStatus = "running";
    return true;
  }

  async markReviewFailed(userId: string, sessionId: string) {
    const session = this.owned(userId, sessionId);
    if (session) session.reviewStatus = "failed";
  }

  async saveAnalysis(input: {
    userId: string;
    sessionId: string;
    review: ConversationReview;
    corrected: { turnId: string; text: string }[];
  }) {
    const session = this.owned(input.userId, input.sessionId);
    if (!session) return;
    session.review = input.review;
    session.reviewStatus = "ready";
    for (const fix of input.corrected) {
      const turn = this.turns.find((candidate) => candidate.id === fix.turnId);
      if (turn) turn.correctedText = fix.text;
    }
  }

  async markCardsConfirmed(userId: string, sessionId: string, now: Date) {
    const session = this.owned(userId, sessionId);
    if (!session || session.cardsConfirmedAt) return false;
    session.cardsConfirmedAt = now;
    return true;
  }

  async findTurnText(userId: string, turnId: string) {
    const turn = this.turns.find((candidate) => candidate.id === turnId);
    const owned =
      turn && this.sessions.some((session) => session.id === turn.sessionId && session.userId === userId);
    return owned && turn ? (turn.correctedText ?? turn.text) : null;
  }
}

const SEASON = {
  level: "B1" as const,
  episodes: [{ id: "ep-verbs", title: "Verbos I: presente e passado", theme: "verbos" }],
};

function setup(tutor: TutorProvider = new FakeTutorProvider()) {
  const conversations = new InMemoryConversations();
  const xp: { userId: string; sourceId: string; amount: number }[] = [];
  const mistakes: string[] = [];
  const created: { userId: string; cards: NewCard[] }[] = [];
  const placed: { userId: string; sessionId: string; cards: CardPlacement[] }[] = [];
  const notifications: ConversationNotification[] = [];
  const deps = {
    conversations,
    resolveTutor: async () => tutor,
    recentMistakes: async () => mistakes,
    awardXp: async (input: { userId: string; sourceId: string; amount: number }) => {
      if (!xp.some((event) => event.sourceId === input.sourceId))
        xp.push({ userId: input.userId, sourceId: input.sourceId, amount: input.amount });
    },
    seasonContext: async () => SEASON,
    createCards: async (userId: string, cards: NewCard[]) => {
      created.push({ userId, cards });
      return cards.map((card) => `item:${card.term}`);
    },
    placeCards: async (input: { userId: string; sessionId: string; cards: CardPlacement[] }) => {
      placed.push(input);
      return { newEpisodes: input.cards.filter((card) => card.episodeId === null).length };
    },
    notify: async (input: ConversationNotification) => {
      notifications.push(input);
    },
    clock: new FixedClock("2026-10-11T12:00:00Z"),
    ids: new SequentialIds("c"),
  };
  return {
    conversations,
    xp,
    tutor,
    created,
    placed,
    notifications,
    start: makeStartConversation(deps),
    get: makeGetConversation(deps),
    list: makeListConversations(deps),
    send: makeSendMessage(deps),
    close: makeCloseConversation(deps),
    requestReview: makeRequestConversationReview(deps),
    runReview: makeRunConversationReview(deps),
    confirm: makeConfirmConversationCards(deps),
    requestTerms: makeRequestTermCards(deps),
    runTerms: makeRunTermCards(deps),
    turnText: makeGetTurnSpeechText(deps),
    profile: makeGetLearnerProfile(deps),
    mistakes,
  };
}

async function talk(app: ReturnType<typeof setup>, userId: string, messages: string[], themeId = "travel") {
  const { sessionId } = await app.start({ userId, themeId, customTopic: null, level: "A1", language: "en" });
  for (const text of messages) {
    await app.send({ userId, sessionId, level: "A1", language: "en", message: { text } });
  }
  return sessionId;
}

function silentTutor(overrides: Partial<TutorProvider>): TutorProvider {
  return {
    name: "gemini",
    reply: async () => ({ transcript: null, reply: "Nice!", replyTranslation: null, corrections: [] }),
    review: async () => ({}),
    explainTerms: async () => ({ terms: [] }),
    describeSeries: async () => ({}),
    ...overrides,
  };
}

describe("temas", () => {
  it("resolve tema pronto e tema livre, e recusa assunto vazio ou com marcação", () => {
    expect(resolveTheme("travel", null, "en")).toMatchObject({ id: "travel", title: THEMES[2]?.topic });
    expect(resolveTheme("custom", "  futebol de domingo ", "en")).toMatchObject({
      id: "custom",
      title: "futebol de domingo",
    });
    expect(resolveTheme("custom", "   ", "en")).toBeNull();
    expect(resolveTheme("custom", "<script>", "en")).toBeNull();
    expect(resolveTheme("inexistente", null, "en")).toBeNull();
  });
});

describe("conversa aberta com o tutor", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("abre a conversa pelo tema com uma pergunta do tutor", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "shows",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    const view = await app.get("ana", sessionId, "en");
    expect(view.session).toMatchObject({ themeTitle: THEMES[3]?.topic, review: null });
    expect(view.turns.map((turn) => [turn.role, turn.text])).toEqual([
      ["tutor", "Hey! What have you been watching lately?"],
    ]);
    expect(view).toMatchObject({ simulated: true, turnsLeft: MAX_USER_TURNS });
    await expect(
      app.start({ userId: "ana", themeId: "custom", customTopic: "", level: "A1", language: "en" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("responde e corrige a frase na hora, sem criar card antes da revisão", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "food",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    const result = await app.send({
      userId: "ana",
      sessionId,
      level: "A1",
      language: "en",
      message: { text: "I want a coffee and more better bread" },
    });
    expect(result.userTurn.corrections.map((correction) => [correction.wrong, correction.right])).toEqual([
      ["I want", "I'd like"],
      ["more better", "better"],
    ]);
    expect(result.tutorTurn).toMatchObject({
      role: "tutor",
      text: "Interesting! Can you tell me a bit more about that?",
    });
    expect(app.created).toEqual([]);
    expect((await app.get("ana", sessionId, "en")).turns).toHaveLength(3);
  });

  it("aceita áudio e usa a transcrição como mensagem do usuário", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "B1",
      language: "en",
    });
    const result = await app.send({
      userId: "ana",
      sessionId,
      level: "B1",
      language: "en",
      message: { audio: { mimeType: "audio/webm;codecs=opus", base64: "AAAA" } },
    });
    expect(result.userTurn.text).toBe("I recorded an audio message.");
    await expect(
      app.send({
        userId: "ana",
        sessionId,
        level: "B1",
        language: "en",
        message: { audio: { mimeType: "video/mp4", base64: "AAAA" } },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("valida a mensagem e limita o tamanho da conversa", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "B1",
      language: "en",
    });
    await expect(
      app.send({ userId: "ana", sessionId, level: "B1", language: "en", message: { text: "   " } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.send({ userId: "ana", sessionId, level: "B1", language: "en", message: { text: "x".repeat(501) } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    for (let turn = 0; turn < MAX_USER_TURNS; turn += 1) {
      await app.send({
        userId: "ana",
        sessionId,
        level: "B1",
        language: "en",
        message: { text: `message ${turn}` },
      });
    }
    await expect(
      app.send({ userId: "ana", sessionId, level: "B1", language: "en", message: { text: "one more" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await app.get("ana", sessionId, "en")).turnsLeft).toBe(0);
  });

  it("envios simultâneos não passam do limite, e uma falha do tutor devolve a vaga", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "B1",
      language: "en",
    });
    app.conversations.used.set(sessionId, MAX_USER_TURNS - 1);
    const results = await Promise.allSettled(
      [1, 2, 3].map((n) =>
        app.send({
          userId: "ana",
          sessionId,
          level: "B1",
          language: "en",
          message: { text: `message ${n}` },
        }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);

    const failing = silentTutor({
      reply: async () => {
        throw new Error("rede");
      },
    });
    const down = setup(failing);
    const other = await down.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "B1",
      language: "en",
    });
    await expect(
      down.send({
        userId: "ana",
        sessionId: other.sessionId,
        level: "B1",
        language: "en",
        message: { text: "hi" },
      }),
    ).rejects.toMatchObject({ code: "LLM_FAILED" });
    expect(down.conversations.used.get(other.sessionId)).toBe(0);
  });

  it("um usuário não lê, não escreve, não revisa nem ouve a conversa do outro", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "work",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    const sent = await app.send({
      userId: "ana",
      sessionId,
      level: "A1",
      language: "en",
      message: { text: "I am agree with you" },
    });
    await expect(app.get("lucas", sessionId, "en")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.send({ userId: "lucas", sessionId, level: "C1", language: "en", message: { text: "hello" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.close({ userId: "lucas", sessionId, language: "en", withReview: true }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await app.close({ userId: "ana", sessionId, language: "en", withReview: true });
    await app.runReview({ userId: "lucas", sessionId, level: "C1" });
    expect(
      app.tutor instanceof FakeTutorProvider && app.tutor.calls.some((call) => call.kind === "review"),
    ).toBe(false);
    await expect(
      app.confirm({ userId: "lucas", sessionId, language: "en", difficultyIds: ["d0"] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.requestTerms({ userId: "lucas", sessionId, language: "en", marks: [] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(app.turnText("lucas", sent.tutorTurn.id)).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    expect(await app.turnText("ana", sent.tutorTurn.id)).toBe(sent.tutorTurn.text);
    expect(await app.list("lucas", "en")).toEqual([]);
    expect(await app.list("ana", "en")).toMatchObject([{ id: sessionId, turnCount: 3 }]);
  });

  it("encerrar fecha a conversa para novas mensagens e paga XP uma vez, só com conversa de verdade", async () => {
    const empty = await talk(app, "ana", []);
    await expect(
      app.close({ userId: "ana", sessionId: empty, language: "en", withReview: false }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    const short = await talk(app, "ana", ["He go to the beach"]);
    expect(await app.close({ userId: "ana", sessionId: short, language: "en", withReview: false })).toEqual({
      xpAwarded: 0,
      reviewQueued: false,
    });

    const sessionId = await talk(app, "ana", [
      "He go to the beach",
      "Peoples are nice there",
      "I like the food",
    ]);
    const closed = await app.close({ userId: "ana", sessionId, language: "en", withReview: false });
    expect(closed).toEqual({ xpAwarded: 15, reviewQueued: false });
    expect(await app.close({ userId: "ana", sessionId, language: "en", withReview: false })).toEqual({
      xpAwarded: 0,
      reviewQueued: false,
    });
    expect(app.xp).toEqual([{ userId: "ana", sourceId: sessionId, amount: 15 }]);
    const view = await app.get("ana", sessionId, "en");
    expect(view.session).toMatchObject({ reviewStatus: "none", review: null });
    expect(view.session.closedAt).not.toBeNull();
    await expect(
      app.send({ userId: "ana", sessionId, level: "A1", language: "en", message: { text: "one more" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", detail: { key: "conversationClosed" } });
  });

  it("revisa em segundo plano: fila, dificuldades, falas corrigidas e aviso no sino", async () => {
    const sessionId = await talk(app, "ana", [
      "He go to the beach",
      "Peoples are nice there",
      "I like the food",
    ]);
    expect(await app.close({ userId: "ana", sessionId, language: "en", withReview: true })).toEqual({
      xpAwarded: 15,
      reviewQueued: true,
    });
    expect((await app.get("ana", sessionId, "en")).session.reviewStatus).toBe("queued");

    await app.runReview({ userId: "ana", sessionId, level: "A1" });
    const view = await app.get("ana", sessionId, "en");
    expect(view.session.reviewStatus).toBe("ready");
    expect(view.session.review?.score).toBe(70);
    expect(view.session.review?.difficulties.map((item) => [item.id, item.target, item.episodeId])).toEqual([
      ["d0", "he goes", "ep-verbs"],
      ["d1", "people", null],
    ]);
    expect(view.session.review?.phrases.map((phrase) => phrase.right)).toEqual(["he goes", "people"]);
    expect(view.turns[1]?.correctedText).toBe("he goes to the beach");
    expect(await app.turnText("ana", view.turns[1]?.id ?? "")).toBe("he goes to the beach");
    expect(app.notifications).toEqual([
      {
        userId: "ana",
        kind: "conversation_review_ready",
        params: { theme: THEMES[2]?.topic, themeId: "travel", count: 2 },
        href: `/tutor/${sessionId}`,
      },
    ]);
    await app.runReview({ userId: "ana", sessionId, level: "A1" });
    expect(app.notifications).toHaveLength(1);
  });

  it("encerrar sem avaliação deixa pedir a avaliação depois; falha da IA permite tentar de novo", async () => {
    const offline = setup(
      silentTutor({
        review: async () => {
          throw new Error("rede");
        },
      }),
    );
    const sessionId = await talk(offline, "ana", ["hello", "nice day", "bye"]);
    await offline.close({ userId: "ana", sessionId, language: "en", withReview: false });
    expect(await offline.requestReview({ userId: "ana", sessionId, language: "en" })).toEqual({
      reviewQueued: true,
    });
    expect(await offline.requestReview({ userId: "ana", sessionId, language: "en" })).toEqual({
      reviewQueued: false,
    });
    await offline.runReview({ userId: "ana", sessionId, level: "A1" });
    expect((await offline.get("ana", sessionId, "en")).session.reviewStatus).toBe("failed");
    expect(offline.notifications[0]).toMatchObject({
      kind: "conversation_review_failed",
      params: { reason: "LLM_FAILED" },
    });
    expect(await offline.requestReview({ userId: "ana", sessionId, language: "en" })).toEqual({
      reviewQueued: true,
    });

    const open = await talk(app, "ana", ["hi"]);
    await expect(app.requestReview({ userId: "ana", sessionId: open, language: "en" })).rejects.toMatchObject(
      {
        detail: { key: "conversationOpen" },
      },
    );
  });

  it("tenta a revisão de novo uma vez quando a IA responde fora do formato", async () => {
    let calls = 0;
    const flaky = setup(
      silentTutor({
        review: async () => {
          calls += 1;
          return calls === 1 ? { summary: "<b>" } : { summary: "Boa.", score: "64", difficulties: [] };
        },
      }),
    );
    const sessionId = await talk(flaky, "ana", ["hello", "nice day", "bye"]);
    await flaky.close({ userId: "ana", sessionId, language: "en", withReview: true });
    await flaky.runReview({ userId: "ana", sessionId, level: "A1" });
    expect(calls).toBe(2);
    expect((await flaky.get("ana", sessionId, "en")).session).toMatchObject({
      reviewStatus: "ready",
      review: { score: 64 },
    });
  });

  it("cria cards só das dificuldades escolhidas, distribui na série e não repete", async () => {
    const sessionId = await talk(app, "ana", ["He go to the beach", "Peoples are nice there", "I like it"]);
    await expect(
      app.confirm({ userId: "ana", sessionId, language: "en", difficultyIds: ["d0"] }),
    ).rejects.toMatchObject({ detail: { key: "reviewNotReady" } });
    await app.close({ userId: "ana", sessionId, language: "en", withReview: true });
    await app.runReview({ userId: "ana", sessionId, level: "A1" });

    expect(
      await app.confirm({ userId: "ana", sessionId, language: "en", difficultyIds: ["d1", "inexistente"] }),
    ).toEqual({ cards: 1, newEpisodes: 1 });
    expect(app.created).toEqual([
      { userId: "ana", cards: [{ term: "people", meaning: "pessoas", context: "Peoples" }] },
    ]);
    expect(app.placed[0]).toEqual({
      userId: "ana",
      sessionId,
      cards: [{ learningItemId: "item:people", theme: "Plural", episodeId: null, episodeTitle: "Plural" }],
    });
    await expect(
      app.confirm({ userId: "ana", sessionId, language: "en", difficultyIds: ["d0"] }),
    ).rejects.toMatchObject({ detail: { key: "cardsAlreadyConfirmed" } });
    expect(app.created).toHaveLength(1);
  });

  it("palavras marcadas na conversa encerrada viram cards pela IA, só com trecho que existe na fala", async () => {
    const sessionId = await talk(app, "ana", ["I like the food"]);
    const turns = (await app.get("ana", sessionId, "en")).turns;
    const tutorTurn = turns[2];
    await expect(
      app.requestTerms({
        userId: "ana",
        sessionId,
        language: "en",
        marks: [{ turnId: tutorTurn?.id ?? "", text: "more" }],
      }),
    ).rejects.toMatchObject({ detail: { key: "conversationOpen" } });
    await app.close({ userId: "ana", sessionId, language: "en", withReview: false });
    const { terms } = await app.requestTerms({
      userId: "ana",
      sessionId,
      language: "en",
      marks: [
        { turnId: tutorTurn?.id ?? "", text: " a  bit " },
        { turnId: tutorTurn?.id ?? "", text: "A bit" },
        { turnId: tutorTurn?.id ?? "", text: "não está na fala" },
        { turnId: "outra", text: "bit" },
      ],
    });
    expect(terms).toEqual([{ turnId: tutorTurn?.id, term: "a bit", sentence: tutorTurn?.text }]);
    await expect(
      app.requestTerms({ userId: "ana", sessionId, language: "en", marks: [{ turnId: "x", text: "y" }] }),
    ).rejects.toMatchObject({ detail: { key: "noTermsMarked" } });

    await app.runTerms({ userId: "ana", sessionId, level: "A1", terms });
    expect(app.created[0]?.cards).toEqual([
      { term: "a bit", meaning: 'significado de "a bit" (simulado)', context: tutorTurn?.text },
    ]);
    expect(app.placed[0]?.cards[0]).toMatchObject({ theme: "Vocabulário das conversas", episodeId: null });
    expect(app.notifications.at(-1)).toMatchObject({
      kind: "conversation_terms_ready",
      params: { count: 1 },
    });
  });

  it("recusa resposta do tutor fora do formato ou com link, e trata falha do provedor", async () => {
    const broken = silentTutor({
      reply: async () => ({ reply: "veja https://exemplo.test" }),
      review: async () => ({ summary: 1 }),
    });
    const strict = setup(broken);
    const { sessionId } = await strict.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    await expect(
      strict.send({ userId: "ana", sessionId, level: "A1", language: "en", message: { text: "hi" } }),
    ).rejects.toMatchObject({ code: "LLM_INVALID_OUTPUT" });
    expect((await strict.get("ana", sessionId, "en")).turns).toHaveLength(1);

    const offline = silentTutor({
      reply: async () => {
        throw new Error("rede");
      },
    });
    const down = setup(offline);
    const other = await down.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    await expect(
      down.send({
        userId: "ana",
        sessionId: other.sessionId,
        level: "A1",
        language: "en",
        message: { text: "hi" },
      }),
    ).rejects.toMatchObject({ code: "LLM_FAILED" });
  });

  it("os schemas descartam correções inválidas sem derrubar a resposta", () => {
    const reply = tutorReplySchema.parse({
      reply: "Nice!",
      corrections: [{ wrong: "a", right: "b", why: "c" }, { wrong: "<b>", right: "x", why: "y" }, "texto"],
    });
    expect(reply.corrections).toEqual([{ wrong: "a", right: "b", why: "c" }]);
    expect(conversationAnalysisSchema.safeParse({ summary: "ok", score: 140 }).success).toBe(false);
    const analysis = conversationAnalysisSchema.parse({
      summary: "ok",
      score: 81.6,
      difficulties: [
        {
          kind: "estranho",
          turn: 1,
          target: "people",
          translation: "pessoas",
          why: "plural",
          theme: "Plural",
          episodeTitle: "Plural I",
          episodeId: "x".repeat(80),
        },
        { kind: "grammar", target: "<b>", translation: "x", why: "y", theme: "t", episodeTitle: "t" },
      ],
    });
    expect(analysis).toMatchObject({ score: 82, strengths: [], corrected: [] });
    expect(analysis.difficulties).toEqual([
      expect.objectContaining({ kind: "vocabulary", target: "people", episodeId: null }),
    ]);
    const review = reviewFromAnalysis(
      conversationAnalysisSchema.parse({
        summary: "ok",
        score: 50,
        difficulties: [
          {
            kind: "tutor",
            turn: 1,
            said: "x",
            target: "a",
            translation: "b",
            why: "c",
            theme: "t",
            episodeTitle: "t",
          },
          {
            kind: "grammar",
            turn: 0,
            said: "x",
            target: "d",
            translation: "e",
            why: "f",
            theme: "t",
            episodeTitle: "t",
          },
        ],
      }),
      [{ role: "tutor" }, { role: "user" }],
      { level: "A1", episodes: [] },
    );
    expect(review.difficulties.map((item) => [item.kind, item.said])).toEqual([
      ["vocabulary", "x"],
      ["tutor", null],
    ]);
  });

  it("abre no idioma de estudo e não mistura conversas de idiomas diferentes", async () => {
    const spanish = await app.start({
      userId: "ana",
      themeId: "travel",
      customTopic: null,
      level: "A2",
      language: "es",
    });
    const view = await app.get("ana", spanish.sessionId, "es");
    expect(view.turns[0]?.text).toBe("¡Hola! ¿Cuál es el mejor viaje que has hecho?");
    await app.start({ userId: "ana", themeId: "daily", customTopic: null, level: "B1", language: "en" });
    expect((await app.list("ana", "es")).map((session) => session.id)).toEqual([spanish.sessionId]);
    await expect(app.get("ana", spanish.sessionId, "en")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(resolveTheme("custom", "fútbol", "es")?.opener).toBe(
      "¡Hola! Hablemos de fútbol. ¿Qué te gustaría contar sobre eso?",
    );
    for (const language of ["en", "pt-BR", "es", "fr"] as const) {
      for (const theme of THEMES) expect(resolveTheme(theme.id, null, language)?.opener).toBeTruthy();
    }
  });

  it("o tutor recebe o resumo do aluno: revisões anteriores e erros recorrentes do mesmo idioma", async () => {
    const seen: unknown[] = [];
    const watcher = silentTutor({
      name: "fake",
      reply: async (input) => {
        seen.push(input.learner);
        return { transcript: null, reply: "Nice!", replyTranslation: null, corrections: [] };
      },
      review: async () => ({
        summary: "Boa conversa.",
        score: 70,
        strengths: ["vocabulário de viagem"],
        improvements: ["usar o passado simples"],
      }),
    });
    const t = setup(watcher);
    t.mistakes.push("split the bill", "pick up the tab");
    const first = await t.start({
      userId: "ana",
      themeId: "travel",
      customTopic: null,
      level: "B1",
      language: "en",
    });
    await t.send({
      userId: "ana",
      sessionId: first.sessionId,
      level: "B1",
      language: "en",
      message: { text: "I go to Rio last year" },
    });
    expect(seen[0]).toMatchObject({ improvements: [], mistakes: ["split the bill", "pick up the tab"] });
    await t.close({ userId: "ana", sessionId: first.sessionId, language: "en", withReview: true });
    await t.runReview({ userId: "ana", sessionId: first.sessionId, level: "B1" });
    const second = await t.start({
      userId: "ana",
      themeId: "food",
      customTopic: null,
      level: "B1",
      language: "en",
    });
    await t.send({
      userId: "ana",
      sessionId: second.sessionId,
      level: "B1",
      language: "en",
      message: { text: "I like pasta" },
    });
    expect(seen[1]).toMatchObject({
      improvements: ["usar o passado simples"],
      strengths: ["vocabulário de viagem"],
      averageScore: 70,
    });
    expect(await t.profile("lucas", "en")).toMatchObject({ improvements: [], averageScore: null });
  });
});
