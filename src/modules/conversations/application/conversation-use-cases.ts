import { AppError, isAppError } from "@/shared/errors";
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
  conversationReviewSchema,
  resolveTheme,
  tutorReplySchema,
  type ConversationReview,
  type Correction,
  type LearnerProfile,
  type Session,
  type Turn,
  type TurnRole,
} from "../domain/conversation";

export type TutorMessage = { text: string } | { audio: { mimeType: string; base64: string } };

export interface TutorProvider {
  readonly name: string;
  reply(input: {
    level: CefrLevel;
    theme: string;
    history: { role: TurnRole; text: string }[];
    message: TutorMessage;
    learner: LearnerProfile;
  }): Promise<unknown>;
  review(input: {
    level: CefrLevel;
    theme: string;
    turns: { role: TurnRole; text: string }[];
  }): Promise<unknown>;
}

export interface ConversationRepository {
  createSession(input: {
    id: string;
    userId: string;
    themeId: string;
    themeTitle: string;
    level: CefrLevel;
    language: StudyLanguage;
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
  saveReview(userId: string, sessionId: string, review: ConversationReview, now: Date): Promise<void>;
  findTurnText(userId: string, turnId: string): Promise<string | null>;
}

type Deps = {
  conversations: ConversationRepository;
  resolveTutor: (userId: string) => Promise<TutorProvider>;
  queueCorrections: (userId: string, corrections: Correction[], sourceLabel: string) => Promise<number>;
  recentMistakes: (userId: string, language: StudyLanguage) => Promise<string[]>;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  clock: Clock;
  ids: IdGenerator;
};

const RECENT_SESSIONS = 8;
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
  }): Promise<{ sessionId: string }> {
    const theme = resolveTheme(input.themeId, input.customTopic, input.language);
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

export function makeSendMessage(deps: Deps) {
  const getLearnerProfile = makeGetLearnerProfile(deps);
  return async function sendMessage(input: {
    userId: string;
    sessionId: string;
    level: CefrLevel;
    language: StudyLanguage;
    message: TutorMessage;
  }): Promise<{ userTurn: Turn; tutorTurn: Turn; queuedForReview: number }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
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
      createdAt: now,
    };
    const tutorTurn: Turn = {
      id: deps.ids.next(),
      role: "tutor",
      text: parsed.data.reply,
      translation: parsed.data.replyTranslation,
      corrections: [],
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
    const queuedForReview =
      parsed.data.corrections.length > 0
        ? await deps.queueCorrections(input.userId, parsed.data.corrections, session.themeTitle)
        : 0;
    return { userTurn, tutorTurn, queuedForReview };
  };
}

export function makeReviewConversation(deps: Deps) {
  return async function reviewConversation(input: {
    userId: string;
    sessionId: string;
    level: CefrLevel;
    language: StudyLanguage;
  }): Promise<{ review: ConversationReview; xpAwarded: number; queuedForReview: number }> {
    const session = await findSessionIn(deps.conversations, input.userId, input.sessionId, input.language);
    const turns = await deps.conversations.listTurns(input.sessionId);
    const userTurns = turns.filter((turn) => turn.role === "user");
    if (userTurns.length === 0) {
      throw new AppError("INVALID_INPUT", "talkBeforeReview");
    }
    const tutor = await deps.resolveTutor(input.userId);
    let raw: unknown;
    try {
      raw = await tutor.review({
        level: input.level,
        theme: session.themeTitle,
        turns: turns.map((turn) => ({ role: turn.role, text: turn.text })),
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError("LLM_FAILED", "tutorSilent");
    }
    const parsed = conversationReviewSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("LLM_INVALID_OUTPUT", "reviewMalformed");
    await deps.conversations.saveReview(input.userId, input.sessionId, parsed.data, deps.clock.now());
    const queuedForReview =
      parsed.data.phrases.length > 0
        ? await deps.queueCorrections(input.userId, parsed.data.phrases, `Conversa · ${session.themeTitle}`)
        : 0;
    const earns = userTurns.length >= MIN_TURNS_FOR_XP;
    if (earns) {
      await deps.awardXp({
        userId: input.userId,
        source: "conversation",
        sourceId: input.sessionId,
        amount: CONVERSATION_XP,
      });
    }
    return { review: parsed.data, xpAwarded: earns ? CONVERSATION_XP : 0, queuedForReview };
  };
}

export function makeGetTurnSpeechText(deps: Pick<Deps, "conversations">) {
  return async function getTurnSpeechText(userId: string, turnId: string): Promise<string> {
    const text = await deps.conversations.findTurnText(userId, turnId);
    if (!text) throw new AppError("ITEM_NOT_FOUND");
    return text;
  };
}
