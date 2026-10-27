import { AppError, isAppError, type MessageParams } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { StudyLanguage } from "@/shared/study-languages";
import {
  CONVERSATION_XP,
  HISTORY_TURNS_SENT,
  MAX_AUDIO_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_USER_TURNS,
  MIN_TURNS_FOR_XP,
  buildLearnerProfile,
  conversationAnalysisSchema,
  correctedTurns,
  episodeContextSchema,
  episodeTheme,
  resolveTheme,
  reviewFromAnalysis,
  selectMarkedTerms,
  termExplanationsSchema,
  tutorReplySchema,
  type ConversationAnalysis,
  type ConversationReview,
  type Correction,
  type EpisodeContext,
  type LearnerProfile,
  type ReviewStatus,
  type SeasonContext,
  type Session,
  type Turn,
  type TurnRole,
} from "../domain/conversation";
import { routes } from "@/shared/routes";

export type TutorMessage = { text: string } | { audio: { mimeType: string; base64: string } };

export interface TutorProvider {
  readonly name: string;
  reply(input: {
    level: CefrLevel;
    theme: string;
    history: { role: TurnRole; text: string }[];
    message: TutorMessage;
    learner: LearnerProfile;
    episode: EpisodeContext | null;
  }): Promise<unknown>;
  review(input: {
    level: CefrLevel;
    theme: string;
    turns: { index: number; role: TurnRole; text: string }[];
    season: SeasonContext;
  }): Promise<unknown>;
  explainTerms(input: {
    level: CefrLevel;
    theme: string;
    terms: { term: string; sentence: string }[];
    season: SeasonContext;
  }): Promise<unknown>;
  describeSeries(input: {
    level: CefrLevel;
    episodes: { title: string; cards: number }[];
    recentTopics: string[];
    improvements: string[];
  }): Promise<unknown>;
}

export type ConversationNotification = {
  userId: string;
  kind: "conversation_review_ready" | "conversation_review_failed" | "conversation_terms_ready";
  params: MessageParams;
  href: string;
};

export type NewCard = { term: string; meaning: string; context: string | null };
export type CardPlacement = {
  learningItemId: string;
  theme: string;
  episodeId: string | null;
  episodeTitle: string;
};

export interface ConversationRepository {
  createSession(input: {
    id: string;
    userId: string;
    themeId: string;
    themeTitle: string;
    level: CefrLevel;
    language: StudyLanguage;
    episode: EpisodeContext | null;
    now: Date;
  }): Promise<void>;
  findSession(userId: string, sessionId: string): Promise<Session | null>;
  listSessions(
    userId: string,
    language: StudyLanguage,
    limit: number,
  ): Promise<(Session & { turnCount: number })[]>;
  addTurn(input: {
    id: string;
    sessionId: string;
    role: TurnRole;
    text: string;
    translation: string | null;
    corrections: Correction[];
    inputKind: "text" | "audio";
    now: Date;
  }): Promise<void>;
  listTurns(sessionId: string): Promise<Turn[]>;
  claimUserTurn(userId: string, sessionId: string, max: number): Promise<boolean>;
  releaseUserTurn(userId: string, sessionId: string): Promise<void>;
  closeSession(userId: string, sessionId: string, reviewStatus: ReviewStatus, now: Date): Promise<boolean>;
  queueReview(userId: string, sessionId: string, now: Date): Promise<boolean>;
  markReviewRunning(userId: string, sessionId: string): Promise<boolean>;
  markReviewFailed(userId: string, sessionId: string, now: Date): Promise<void>;
  saveAnalysis(input: {
    userId: string;
    sessionId: string;
    review: ConversationReview;
    corrected: { turnId: string; text: string }[];
    now: Date;
  }): Promise<void>;
  markCardsConfirmed(userId: string, sessionId: string, now: Date): Promise<boolean>;
  findTurnText(userId: string, turnId: string): Promise<string | null>;
}

type Deps = {
  conversations: ConversationRepository;
  resolveTutor: (userId: string) => Promise<TutorProvider>;
  seasonContext: (userId: string) => Promise<SeasonContext>;
  createCards: (userId: string, cards: NewCard[]) => Promise<string[]>;
  placeCards: (input: {
    userId: string;
    sessionId: string;
    cards: CardPlacement[];
  }) => Promise<{ newEpisodes: number }>;
  notify: (input: ConversationNotification) => Promise<void>;
  recentMistakes: (userId: string, language: StudyLanguage) => Promise<string[]>;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  clock: Clock;
  ids: IdGenerator;
};

const RECENT_SESSIONS = 8;
const REVIEW_ATTEMPTS = 2;
const PROFILE_SESSIONS = 12;

async function findSessionIn(
  conversations: ConversationRepository,
  userId: string,
  sessionId: string,
  language: StudyLanguage,
): Promise<Session> {
  const session = await conversations.findSession(userId, sessionId);
  if (!session || session.language !== language) throw new AppError("INVALID_INPUT", "conversationNotFound");
  return session;
}

export function makeGetLearnerProfile(deps: Pick<Deps, "conversations" | "recentMistakes">) {
  return async function getLearnerProfile(userId: string, language: StudyLanguage): Promise<LearnerProfile> {
    const [sessions, mistakes] = await Promise.all([
      deps.conversations.listSessions(userId, language, PROFILE_SESSIONS),
      deps.recentMistakes(userId, language),
    ]);
    return buildLearnerProfile({ sessions, mistakes });
  };
}
const AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/aac"];
const BASE64_OVERHEAD = 4 / 3;

export type ConversationView = { session: Session; turns: Turn[]; simulated: boolean; turnsLeft: number };

export function makeStartConversation(deps: Pick<Deps, "conversations" | "clock" | "ids">) {
  return async function startConversation(input: {
    userId: string;
    themeId: string;
    customTopic: string | null;
    level: CefrLevel;
    language: StudyLanguage;
    episode?: EpisodeContext | null;
  }): Promise<{ sessionId: string }> {
    const episode = input.episode ? episodeContextSchema.safeParse(input.episode) : null;
    if (episode && !episode.success) throw new AppError("INVALID_INPUT", "themeRequired");
    const theme = episode?.success
      ? episodeTheme(episode.data, input.language)
      : resolveTheme(input.themeId, input.customTopic, input.language);
    if (!theme) throw new AppError("INVALID_INPUT", "themeRequired");
    const now = deps.clock.now();
    const sessionId = deps.ids.next();
    await deps.conversations.createSession({
      id: sessionId,
      userId: input.userId,
      themeId: theme.id,
      themeTitle: theme.title,
      level: input.level,
      language: input.language,
      episode: episode?.success ? episode.data : null,
      now,
    });
    await deps.conversations.addTurn({
      id: deps.ids.next(),
      sessionId,
      role: "tutor",
      text: theme.opener,
      translation: null,
      corrections: [],
      inputKind: "text",
      now,
    });
    return { sessionId };
  };
}

export function makeGetConversation(deps: Pick<Deps, "conversations" | "resolveTutor">) {
  return async function getConversation(
    userId: string,
    sessionId: string,
    language: StudyLanguage,
  ): Promise<ConversationView> {
    const session = await findSessionIn(deps.conversations, userId, sessionId, language);
    const [turns, tutor] = await Promise.all([
      deps.conversations.listTurns(sessionId),
      deps.resolveTutor(userId),
    ]);
    const used = turns.filter((turn) => turn.role === "user").length;
    return {
      session,
      turns,
      simulated: tutor.name === "fake",
      turnsLeft: Math.max(0, MAX_USER_TURNS - used),
    };
  };
}

export function makeListConversations(deps: Pick<Deps, "conversations">) {
  return async function listConversations(userId: string, language: StudyLanguage) {
    return deps.conversations.listSessions(userId, language, RECENT_SESSIONS);
  };
}

export function makeSendMessage(
  deps: Pick<Deps, "conversations" | "resolveTutor" | "recentMistakes" | "clock" | "ids">,
) {
  const getLearnerProfile = makeGetLearnerProfile(deps);
  return async function sendMessage(input: {
    userId: string;
    sessionId: string;
    level: CefrLevel;
    language: StudyLanguage;
    message: TutorMessage;
  }): Promise<{ userTurn: Turn; tutorTurn: Turn }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
    if (session.closedAt) throw new AppError("INVALID_INPUT", "conversationClosed");
    const isAudio = "audio" in input.message;
    if ("text" in input.message) {
      const text = input.message.text.trim();
      if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) {
        throw new AppError("INVALID_INPUT", { key: "messageTooLong", params: { max: MAX_MESSAGE_LENGTH } });
      }
    } else {
      const { mimeType, base64 } = input.message.audio;
      const baseType = mimeType.split(";")[0] ?? "";
      if (
        !AUDIO_TYPES.includes(baseType) ||
        base64.length > MAX_AUDIO_BYTES * BASE64_OVERHEAD ||
        base64.length === 0
      ) {
        throw new AppError("INVALID_INPUT", "audioInvalid");
      }
    }

    const turns = await deps.conversations.listTurns(input.sessionId);
    if (!(await deps.conversations.claimUserTurn(input.userId, input.sessionId, MAX_USER_TURNS))) {
      throw new AppError("INVALID_INPUT", "conversationLimit");
    }
    const release = () => deps.conversations.releaseUserTurn(input.userId, input.sessionId);

    const tutor = await deps.resolveTutor(input.userId);
    const learner = await getLearnerProfile(input.userId, input.language);
    let raw: unknown;
    try {
      raw = await tutor.reply({
        learner,
        level: input.level,
        theme: session.themeTitle,
        episode: session.episode,
        history: turns.slice(-HISTORY_TURNS_SENT).map((turn) => ({ role: turn.role, text: turn.text })),
        message: input.message,
      });
    } catch (error) {
      await release();
      if (isAppError(error)) throw error;
      throw new AppError("LLM_FAILED", "tutorSilent");
    }
    const parsed = tutorReplySchema.safeParse(raw);
    if (!parsed.success) {
      await release();
      throw new AppError("LLM_INVALID_OUTPUT", "tutorInvalid");
    }
    const userText = "text" in input.message ? input.message.text.trim() : parsed.data.transcript;
    if (!userText) {
      await release();
      throw new AppError("LLM_INVALID_OUTPUT", "audioNotUnderstood");
    }

    const now = deps.clock.now();
    const userTurn: Turn = {
      id: deps.ids.next(),
      role: "user",
      text: userText,
      translation: null,
      corrections: parsed.data.corrections,
      correctedText: null,
      createdAt: now,
    };
    const tutorTurn: Turn = {
      id: deps.ids.next(),
      role: "tutor",
      text: parsed.data.reply,
      translation: parsed.data.replyTranslation,
      corrections: [],
      correctedText: null,
      createdAt: new Date(now.getTime() + 1),
    };
    await deps.conversations.addTurn({
      ...userTurn,
      sessionId: input.sessionId,
      inputKind: isAudio ? "audio" : "text",
      now: userTurn.createdAt,
    });
    await deps.conversations.addTurn({
      ...tutorTurn,
      sessionId: input.sessionId,
      inputKind: "text",
      now: tutorTurn.createdAt,
    });
    return { userTurn, tutorTurn };
  };
}

export function makeCloseConversation(deps: Pick<Deps, "conversations" | "awardXp" | "clock">) {
  return async function closeConversation(input: {
    userId: string;
    sessionId: string;
    language: StudyLanguage;
    withReview: boolean;
  }): Promise<{ xpAwarded: number; reviewQueued: boolean }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
    const turns = await deps.conversations.listTurns(input.sessionId);
    const userTurns = turns.filter((turn) => turn.role === "user").length;
    if (userTurns === 0) throw new AppError("INVALID_INPUT", "talkBeforeReview");
    const now = deps.clock.now();
    if (session.closedAt) {
      const reviewQueued =
        input.withReview && (await deps.conversations.queueReview(input.userId, input.sessionId, now));
      return { xpAwarded: 0, reviewQueued };
    }
    const closed = await deps.conversations.closeSession(
      input.userId,
      input.sessionId,
      input.withReview ? "queued" : "none",
      now,
    );
    if (!closed) return { xpAwarded: 0, reviewQueued: false };
    const earns = userTurns >= MIN_TURNS_FOR_XP;
    if (earns) {
      await deps.awardXp({
        userId: input.userId,
        source: "conversation",
        sourceId: input.sessionId,
        amount: CONVERSATION_XP,
      });
    }
    return { xpAwarded: earns ? CONVERSATION_XP : 0, reviewQueued: input.withReview };
  };
}

export function makeRequestConversationReview(deps: Pick<Deps, "conversations" | "clock">) {
  return async function requestConversationReview(input: {
    userId: string;
    sessionId: string;
    language: StudyLanguage;
  }): Promise<{ reviewQueued: boolean }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
    if (!session.closedAt) throw new AppError("INVALID_INPUT", "conversationOpen");
    return {
      reviewQueued: await deps.conversations.queueReview(input.userId, input.sessionId, deps.clock.now()),
    };
  };
}

export function makeRunConversationReview(
  deps: Pick<Deps, "conversations" | "resolveTutor" | "seasonContext" | "notify" | "clock">,
) {
  return async function runConversationReview(input: {
    userId: string;
    sessionId: string;
    level: CefrLevel;
  }): Promise<void> {
    const session = await deps.conversations.findSession(input.userId, input.sessionId);
    if (!session?.closedAt) return;
    if (!(await deps.conversations.markReviewRunning(input.userId, input.sessionId))) return;
    const href = routes.conversation(input.sessionId);
    const fail = async (reason: string) => {
      await deps.conversations.markReviewFailed(input.userId, input.sessionId, deps.clock.now());
      await deps.notify({
        userId: input.userId,
        kind: "conversation_review_failed",
        params: { theme: session.themeTitle, themeId: session.themeId, reason },
        href,
      });
    };
    const turns = await deps.conversations.listTurns(input.sessionId);
    const season = await deps.seasonContext(input.userId);
    let analysis: ConversationAnalysis | null = null;
    try {
      const tutor = await deps.resolveTutor(input.userId);
      for (let attempt = 0; attempt < REVIEW_ATTEMPTS && !analysis; attempt += 1) {
        const parsed = conversationAnalysisSchema.safeParse(
          await tutor.review({
            level: input.level,
            theme: session.themeTitle,
            turns: turns.map((turn, index) => ({ index, role: turn.role, text: turn.text })),
            season,
          }),
        );
        if (parsed.success) analysis = parsed.data;
      }
    } catch (error) {
      await fail(isAppError(error) ? error.code : "LLM_FAILED");
      return;
    }
    if (!analysis) {
      await fail("LLM_INVALID_OUTPUT");
      return;
    }
    const review = reviewFromAnalysis(analysis, turns, season);
    await deps.conversations.saveAnalysis({
      userId: input.userId,
      sessionId: input.sessionId,
      review,
      corrected: correctedTurns(analysis, turns),
      now: deps.clock.now(),
    });
    await deps.notify({
      userId: input.userId,
      kind: "conversation_review_ready",
      params: { theme: session.themeTitle, themeId: session.themeId, count: review.difficulties.length },
      href,
    });
  };
}

export function makeConfirmConversationCards(
  deps: Pick<Deps, "conversations" | "createCards" | "placeCards" | "clock">,
) {
  return async function confirmConversationCards(input: {
    userId: string;
    sessionId: string;
    language: StudyLanguage;
    difficultyIds: string[];
  }): Promise<{ cards: number; newEpisodes: number }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
    if (session.reviewStatus !== "ready" || !session.review)
      throw new AppError("INVALID_INPUT", "reviewNotReady");
    if (session.cardsConfirmedAt) throw new AppError("INVALID_INPUT", "cardsAlreadyConfirmed");
    const wanted = new Set(input.difficultyIds);
    const chosen = session.review.difficulties.filter((difficulty) => wanted.has(difficulty.id));
    let newEpisodes = 0;
    if (chosen.length > 0) {
      const itemIds = await deps.createCards(
        input.userId,
        chosen.map((difficulty) => ({
          term: difficulty.target,
          meaning: difficulty.translation,
          context: difficulty.said ?? difficulty.why,
        })),
      );
      ({ newEpisodes } = await deps.placeCards({
        userId: input.userId,
        sessionId: input.sessionId,
        cards: chosen.flatMap((difficulty, index) => {
          const learningItemId = itemIds[index];
          return learningItemId
            ? [
                {
                  learningItemId,
                  theme: difficulty.theme,
                  episodeId: difficulty.episodeId,
                  episodeTitle: difficulty.episodeTitle,
                },
              ]
            : [];
        }),
      }));
    }
    await deps.conversations.markCardsConfirmed(input.userId, input.sessionId, deps.clock.now());
    return { cards: chosen.length, newEpisodes };
  };
}

export function makeRequestTermCards(deps: Pick<Deps, "conversations">) {
  return async function requestTermCards(input: {
    userId: string;
    sessionId: string;
    language: StudyLanguage;
    marks: { turnId: string; text: string }[];
  }): Promise<{ terms: { turnId: string; term: string; sentence: string }[] }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
    if (!session.closedAt) throw new AppError("INVALID_INPUT", "conversationOpen");
    const terms = selectMarkedTerms(input.marks, await deps.conversations.listTurns(input.sessionId));
    if (terms.length === 0) throw new AppError("INVALID_INPUT", "noTermsMarked");
    return { terms };
  };
}

export function makeRunTermCards(
  deps: Pick<
    Deps,
    "conversations" | "resolveTutor" | "seasonContext" | "createCards" | "placeCards" | "notify"
  >,
) {
  return async function runTermCards(input: {
    userId: string;
    sessionId: string;
    level: CefrLevel;
    terms: { turnId: string; term: string; sentence: string }[];
  }): Promise<void> {
    const session = await deps.conversations.findSession(input.userId, input.sessionId);
    if (!session?.closedAt || input.terms.length === 0) return;
    const season = await deps.seasonContext(input.userId);
    const tutor = await deps.resolveTutor(input.userId);
    const parsed = termExplanationsSchema.safeParse(
      await tutor.explainTerms({
        level: input.level,
        theme: session.themeTitle,
        terms: input.terms.map(({ term, sentence }) => ({ term, sentence })),
        season,
      }),
    );
    if (!parsed.success) throw new AppError("LLM_INVALID_OUTPUT", "termsMalformed");
    const known = new Set(season.episodes.map((episode) => episode.id));
    const explained = parsed.data.terms;
    if (explained.length === 0) return;
    const itemIds = await deps.createCards(
      input.userId,
      explained.map((entry) => ({
        term: entry.term,
        meaning: entry.translation,
        context:
          input.terms.find((mark) => mark.term.toLowerCase() === entry.term.toLowerCase())?.sentence ??
          entry.why,
      })),
    );
    await deps.placeCards({
      userId: input.userId,
      sessionId: input.sessionId,
      cards: explained.flatMap((entry, index) => {
        const learningItemId = itemIds[index];
        return learningItemId
          ? [
              {
                learningItemId,
                theme: entry.theme,
                episodeId: entry.episodeId && known.has(entry.episodeId) ? entry.episodeId : null,
                episodeTitle: entry.episodeTitle,
              },
            ]
          : [];
      }),
    });
    await deps.notify({
      userId: input.userId,
      kind: "conversation_terms_ready",
      params: { theme: session.themeTitle, themeId: session.themeId, count: explained.length },
      href: routes.conversation(input.sessionId),
    });
  };
}

export function makeGetTurnSpeechText(deps: Pick<Deps, "conversations">) {
  return async function getTurnSpeechText(userId: string, turnId: string): Promise<string> {
    const text = await deps.conversations.findTurnText(userId, turnId);
    if (!text) throw new AppError("ITEM_NOT_FOUND");
    return text;
  };
}
