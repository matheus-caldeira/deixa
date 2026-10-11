import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import {
  MAX_USER_TURNS,
  conversationReviewSchema,
  resolveTheme,
  tutorReplySchema,
  type ConversationReview,
  type Correction,
  type Session,
  type Turn,
} from "../domain/conversation";
import { FakeTutorProvider } from "../infrastructure/fake-tutor-provider";
import {
  makeGetConversation,
  makeGetTurnSpeechText,
  makeListConversations,
  makeReviewConversation,
  makeSendMessage,
  makeStartConversation,
  type ConversationRepository,
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
    now: Date;
  }) {
    this.sessions.push({
      id: input.id,
      userId: input.userId,
      themeId: input.themeId,
      themeTitle: input.themeTitle,
      level: input.level,
      review: null,
      createdAt: input.now,
    });
  }

  async findSession(userId: string, sessionId: string) {
    const found = this.sessions.find((session) => session.id === sessionId && session.userId === userId);
    if (!found) return null;
    const { userId: _userId, ...session } = found;
    return session;
  }

  async listSessions(userId: string, limit: number) {
    return this.sessions
      .filter((session) => session.userId === userId)
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

  async saveReview(userId: string, sessionId: string, review: ConversationReview) {
    const session = this.sessions.find(
      (candidate) => candidate.id === sessionId && candidate.userId === userId,
    );
    if (session) session.review = review;
  }

  async findTurnText(userId: string, turnId: string) {
    const turn = this.turns.find((candidate) => candidate.id === turnId);
    const owned =
      turn && this.sessions.some((session) => session.id === turn.sessionId && session.userId === userId);
    return owned && turn ? turn.text : null;
  }
}

function setup(tutor: TutorProvider = new FakeTutorProvider()) {
  const conversations = new InMemoryConversations();
  const queued: { userId: string; corrections: Correction[]; label: string }[] = [];
  const xp: { userId: string; sourceId: string; amount: number }[] = [];
  const deps = {
    conversations,
    resolveTutor: async () => tutor,
    queueCorrections: async (userId: string, corrections: Correction[], label: string) => {
      queued.push({ userId, corrections, label });
      return corrections.length;
    },
    awardXp: async (input: { userId: string; sourceId: string; amount: number }) => {
      if (!xp.some((event) => event.sourceId === input.sourceId))
        xp.push({ userId: input.userId, sourceId: input.sourceId, amount: input.amount });
    },
    clock: new FixedClock("2026-10-11T12:00:00Z"),
    ids: new SequentialIds("c"),
  };
  return {
    conversations,
    queued,
    xp,
    tutor,
    start: makeStartConversation(deps),
    get: makeGetConversation(deps),
    list: makeListConversations(deps),
    send: makeSendMessage(deps),
    review: makeReviewConversation(deps),
    turnText: makeGetTurnSpeechText(deps),
  };
}

describe("temas", () => {
  it("resolve tema pronto e tema livre, e recusa assunto vazio ou com marcação", () => {
    expect(resolveTheme("travel", null)).toMatchObject({ id: "travel", title: "Viagens" });
    expect(resolveTheme("custom", "  futebol de domingo ")).toMatchObject({
      id: "custom",
      title: "futebol de domingo",
    });
    expect(resolveTheme("custom", "   ")).toBeNull();
    expect(resolveTheme("custom", "<script>")).toBeNull();
    expect(resolveTheme("inexistente", null)).toBeNull();
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
    });
    const view = await app.get("ana", sessionId);
    expect(view.session).toMatchObject({ themeTitle: "Séries e filmes", review: null });
    expect(view.turns.map((turn) => [turn.role, turn.text])).toEqual([
      ["tutor", "Hey! What have you been watching lately?"],
    ]);
    expect(view).toMatchObject({ simulated: true, turnsLeft: MAX_USER_TURNS });
    await expect(
      app.start({ userId: "ana", themeId: "custom", customTopic: "", level: "A1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("responde, corrige a frase na hora e manda a correção para a revisão", async () => {
    const { sessionId } = await app.start({ userId: "ana", themeId: "food", customTopic: null, level: "A1" });
    const result = await app.send({
      userId: "ana",
      sessionId,
      level: "A1",
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
    expect(result.queuedForReview).toBe(2);
    expect(app.queued[0]).toMatchObject({ userId: "ana", label: "Conversa · Comida" });
    expect((await app.get("ana", sessionId)).turns).toHaveLength(3);
  });

  it("aceita áudio e usa a transcrição como mensagem do usuário", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "B1",
    });
    const result = await app.send({
      userId: "ana",
      sessionId,
      level: "B1",
      message: { audio: { mimeType: "audio/webm;codecs=opus", base64: "AAAA" } },
    });
    expect(result.userTurn.text).toBe("I recorded an audio message.");
    await expect(
      app.send({
        userId: "ana",
        sessionId,
        level: "B1",
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
    });
    await expect(
      app.send({ userId: "ana", sessionId, level: "B1", message: { text: "   " } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.send({ userId: "ana", sessionId, level: "B1", message: { text: "x".repeat(501) } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    for (let turn = 0; turn < MAX_USER_TURNS; turn += 1) {
      await app.send({ userId: "ana", sessionId, level: "B1", message: { text: `message ${turn}` } });
    }
    await expect(
      app.send({ userId: "ana", sessionId, level: "B1", message: { text: "one more" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await app.get("ana", sessionId)).turnsLeft).toBe(0);
  });

  it("envios simultâneos não passam do limite, e uma falha do tutor devolve a vaga", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "B1",
    });
    app.conversations.used.set(sessionId, MAX_USER_TURNS - 1);
    const results = await Promise.allSettled(
      [1, 2, 3].map((n) =>
        app.send({ userId: "ana", sessionId, level: "B1", message: { text: `message ${n}` } }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);

    const failing: TutorProvider = {
      name: "gemini",
      reply: async () => {
        throw new Error("rede");
      },
      review: async () => ({}),
    };
    const down = setup(failing);
    const other = await down.start({ userId: "ana", themeId: "daily", customTopic: null, level: "B1" });
    await expect(
      down.send({ userId: "ana", sessionId: other.sessionId, level: "B1", message: { text: "hi" } }),
    ).rejects.toMatchObject({ code: "LLM_FAILED" });
    expect(down.conversations.used.get(other.sessionId)).toBe(0);
  });

  it("um usuário não lê, não escreve, não revisa nem ouve a conversa do outro", async () => {
    const { sessionId } = await app.start({ userId: "ana", themeId: "work", customTopic: null, level: "A1" });
    const sent = await app.send({
      userId: "ana",
      sessionId,
      level: "A1",
      message: { text: "I am agree with you" },
    });
    await expect(app.get("lucas", sessionId)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.send({ userId: "lucas", sessionId, level: "C1", message: { text: "hello" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(app.review({ userId: "lucas", sessionId, level: "C1" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(app.turnText("lucas", sent.tutorTurn.id)).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    expect(await app.turnText("ana", sent.tutorTurn.id)).toBe(sent.tutorTurn.text);
    expect(await app.list("lucas")).toEqual([]);
    expect(await app.list("ana")).toMatchObject([{ id: sessionId, turnCount: 3 }]);
  });

  it("revisa a conversa inteira, guarda a avaliação e paga XP uma vez, só com conversa de verdade", async () => {
    const { sessionId } = await app.start({
      userId: "ana",
      themeId: "travel",
      customTopic: null,
      level: "A1",
    });
    await expect(app.review({ userId: "ana", sessionId, level: "A1" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await app.send({ userId: "ana", sessionId, level: "A1", message: { text: "He go to the beach" } });
    const short = await app.review({ userId: "ana", sessionId, level: "A1" });
    expect(short.xpAwarded).toBe(0);
    await app.send({ userId: "ana", sessionId, level: "A1", message: { text: "Peoples are nice there" } });
    await app.send({ userId: "ana", sessionId, level: "A1", message: { text: "I like the food" } });

    const reviewed = await app.review({ userId: "ana", sessionId, level: "A1" });
    expect(reviewed.review).toMatchObject({ score: 70 });
    expect(reviewed.review.phrases.map((phrase) => phrase.right)).toEqual(["he goes", "people"]);
    expect(reviewed.xpAwarded).toBe(15);
    await app.review({ userId: "ana", sessionId, level: "A1" });
    expect(app.xp).toEqual([{ userId: "ana", sourceId: sessionId, amount: 15 }]);
    expect((await app.get("ana", sessionId)).session.review?.summary).toContain("3 mensagens");
  });

  it("recusa resposta do tutor fora do formato ou com link, e trata falha do provedor", async () => {
    const broken: TutorProvider = {
      name: "gemini",
      reply: async () => ({ reply: "veja https://exemplo.test" }),
      review: async () => ({ summary: 1 }),
    };
    const strict = setup(broken);
    const { sessionId } = await strict.start({
      userId: "ana",
      themeId: "daily",
      customTopic: null,
      level: "A1",
    });
    await expect(
      strict.send({ userId: "ana", sessionId, level: "A1", message: { text: "hi" } }),
    ).rejects.toMatchObject({ code: "LLM_INVALID_OUTPUT" });
    expect((await strict.get("ana", sessionId)).turns).toHaveLength(1);

    const offline: TutorProvider = {
      name: "gemini",
      reply: async () => {
        throw new Error("rede");
      },
      review: async () => ({}),
    };
    const down = setup(offline);
    const other = await down.start({ userId: "ana", themeId: "daily", customTopic: null, level: "A1" });
    await expect(
      down.send({ userId: "ana", sessionId: other.sessionId, level: "A1", message: { text: "hi" } }),
    ).rejects.toMatchObject({ code: "LLM_FAILED" });
  });

  it("os schemas descartam correções inválidas sem derrubar a resposta", () => {
    const reply = tutorReplySchema.parse({
      reply: "Nice!",
      corrections: [{ wrong: "a", right: "b", why: "c" }, { wrong: "<b>", right: "x", why: "y" }, "texto"],
    });
    expect(reply.corrections).toEqual([{ wrong: "a", right: "b", why: "c" }]);
    expect(conversationReviewSchema.safeParse({ summary: "ok", score: 140 }).success).toBe(false);
    expect(conversationReviewSchema.parse({ summary: "ok", score: 81.6 })).toMatchObject({
      score: 82,
      strengths: [],
      phrases: [],
    });
  });
});
