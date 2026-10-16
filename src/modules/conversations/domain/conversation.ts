import { z } from "zod";
import { cleanLlmText } from "@/shared/llm-text";
import type { CefrLevel } from "@/shared/levels";
import type { StudyLanguage } from "@/shared/study-languages";

export type ThemeIcon = "coffee" | "brief" | "bed" | "film" | "chat" | "target" | "scale" | "spark";
export type Theme = { id: string; icon: ThemeIcon; topic: string };

export const THEMES: readonly Theme[] = [
  {
    id: "daily",
    topic: "everyday life: routine, home, weekends, plans",
    icon: "coffee",
  },
  {
    id: "work",
    topic: "work and studies: projects, meetings, career, college",
    icon: "brief",
  },
  {
    id: "travel",
    topic: "travel: places, mishaps, next destinations",
    icon: "bed",
  },
  {
    id: "shows",
    topic: "shows and movies: what you are watching and what you thought",
    icon: "film",
  },
  {
    id: "food",
    topic: "food: restaurants, recipes, favorites",
    icon: "target",
  },
  {
    id: "opinions",
    topic: "opinions and debates: defending a point, agreeing and disagreeing",
    icon: "scale",
  },
];

export const OPENERS: Record<StudyLanguage, Record<string, string>> = {
  en: {
    daily: "Hi! How's your day going so far?",
    work: "Hey! What are you working on these days?",
    travel: "Hi there! What's the best trip you've ever taken?",
    shows: "Hey! What have you been watching lately?",
    food: "Hi! What's your favorite thing to eat when you go out?",
    opinions: "Hi! Here's a question: is it better to work from home or at the office?",
  },
  "pt-BR": {
    daily: "Oi! Como está sendo o seu dia até agora?",
    work: "E aí! No que você anda trabalhando ultimamente?",
    travel: "Oi! Qual foi a melhor viagem que você já fez?",
    shows: "E aí! O que você tem assistido ultimamente?",
    food: "Oi! Qual é a sua comida preferida quando sai para comer?",
    opinions: "Oi! Uma pergunta: é melhor trabalhar de casa ou no escritório?",
  },
  es: {
    daily: "¡Hola! ¿Qué tal va tu día hasta ahora?",
    work: "¡Hola! ¿En qué estás trabajando estos días?",
    travel: "¡Hola! ¿Cuál es el mejor viaje que has hecho?",
    shows: "¡Hola! ¿Qué has estado viendo últimamente?",
    food: "¡Hola! ¿Qué es lo que más te gusta comer cuando sales?",
    opinions: "¡Hola! Una pregunta: ¿es mejor trabajar desde casa o en la oficina?",
  },
  fr: {
    daily: "Salut ! Comment se passe ta journée jusqu'ici ?",
    work: "Salut ! Sur quoi tu travailles en ce moment ?",
    travel: "Salut ! Quel est le plus beau voyage que tu aies fait ?",
    shows: "Salut ! Qu'est-ce que tu regardes en ce moment ?",
    food: "Salut ! Qu'est-ce que tu préfères manger quand tu sors ?",
    opinions: "Salut ! Une question : vaut-il mieux travailler chez soi ou au bureau ?",
  },
};

const CUSTOM_OPENERS: Record<StudyLanguage, (topic: string) => string> = {
  en: (topic) => `Hi! Let's talk about ${topic}. What would you like to say about it?`,
  "pt-BR": (topic) => `Oi! Vamos conversar sobre ${topic}. O que você gostaria de dizer sobre isso?`,
  es: (topic) => `¡Hola! Hablemos de ${topic}. ¿Qué te gustaría contar sobre eso?`,
  fr: (topic) => `Salut ! Parlons de ${topic}. Qu'est-ce que tu aimerais en dire ?`,
};

export const CUSTOM_THEME_ID = "custom";
export const MAX_TOPIC_LENGTH = 60;
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_USER_TURNS = 40;
export const MAX_AUDIO_BYTES = 1_500_000;
export const MIN_TURNS_FOR_XP = 3;
export const CONVERSATION_XP = 15;
export const HISTORY_TURNS_SENT = 16;

export const MAX_DIFFICULTIES = 10;
export const MAX_MARKED_TERMS = 12;
export const MAX_MARKED_TERM_LENGTH = 80;
export const MAX_THEME_LABEL = 40;
export const MAX_EPISODE_TITLE = 60;

export type Correction = { wrong: string; right: string; why: string };
export type TurnRole = "user" | "tutor";
export type Turn = {
  id: string;
  role: TurnRole;
  text: string;
  translation: string | null;
  corrections: Correction[];
  correctedText: string | null;
  createdAt: Date;
};

export const REVIEW_STATUSES = ["none", "queued", "running", "ready", "failed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const DIFFICULTY_KINDS = ["grammar", "vocabulary", "tutor"] as const;
export type DifficultyKind = (typeof DIFFICULTY_KINDS)[number];

export type Difficulty = {
  id: string;
  kind: DifficultyKind;
  turnIndex: number | null;
  said: string | null;
  target: string;
  translation: string;
  why: string;
  theme: string;
  episodeId: string | null;
  episodeTitle: string;
};

export type ConversationReview = {
  summary: string;
  score: number;
  strengths: string[];
  improvements: string[];
  phrases: Correction[];
  difficulties: Difficulty[];
};

export type Session = {
  id: string;
  language: StudyLanguage;
  themeId: string;
  themeTitle: string;
  level: string;
  review: ConversationReview | null;
  reviewStatus: ReviewStatus;
  closedAt: Date | null;
  cardsConfirmedAt: Date | null;
  createdAt: Date;
};

export type SeasonContext = {
  level: CefrLevel;
  episodes: { id: string; title: string; theme: string }[];
};

export function isReviewStatus(value: string): value is ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(value);
}

const plain = (max: number) =>
  z.unknown().transform((value, context) => {
    const cleaned = cleanLlmText(value, max);
    if (!cleaned) {
      context.addIssue({ code: "custom", message: "invalid text" });
      return z.NEVER;
    }
    return cleaned;
  });

const optionalPlain = (max: number) =>
  z
    .unknown()
    .optional()
    .transform((value) => cleanLlmText(value, max));

const correctionSchema = z.object({ wrong: plain(200), right: plain(200), why: plain(300) });

const tolerantList = <Schema extends z.ZodType>(schema: Schema, max: number) =>
  z
    .array(z.unknown())
    .default([])
    .transform((items) =>
      items
        .flatMap((item) => {
          const parsed = schema.safeParse(item);
          return parsed.success ? [parsed.data as z.infer<Schema>] : [];
        })
        .slice(0, max),
    );

export const tutorReplySchema = z.object({
  transcript: optionalPlain(MAX_MESSAGE_LENGTH),
  reply: plain(700),
  replyTranslation: optionalPlain(700),
  corrections: tolerantList(correctionSchema, 4),
});

const turnIndex = z.number().int().min(0).max(500);
const episodeRef = z
  .unknown()
  .optional()
  .transform((value) => (typeof value === "string" && value.length <= 64 ? value : null));

const difficultySchema = z.object({
  kind: z.enum(DIFFICULTY_KINDS).catch("vocabulary"),
  turn: turnIndex.nullable().optional().catch(null),
  said: optionalPlain(300),
  target: plain(200),
  translation: plain(300),
  why: plain(300),
  theme: plain(MAX_THEME_LABEL),
  episodeId: episodeRef,
  episodeTitle: plain(MAX_EPISODE_TITLE),
});

export const conversationAnalysisSchema = z.object({
  summary: plain(1000),
  score: z.coerce.number().min(0).max(100).transform(Math.round),
  strengths: tolerantList(plain(200), 5),
  improvements: tolerantList(plain(200), 5),
  corrected: tolerantList(z.object({ turn: turnIndex, text: plain(MAX_MESSAGE_LENGTH) }), MAX_USER_TURNS),
  difficulties: tolerantList(difficultySchema, MAX_DIFFICULTIES),
});
export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;

export const termExplanationsSchema = z.object({
  terms: tolerantList(
    z.object({
      term: plain(MAX_MARKED_TERM_LENGTH),
      translation: plain(300),
      why: optionalPlain(300),
      theme: plain(MAX_THEME_LABEL),
      episodeId: episodeRef,
      episodeTitle: plain(MAX_EPISODE_TITLE),
    }),
    MAX_MARKED_TERMS,
  ),
});
export type TermExplanations = z.infer<typeof termExplanationsSchema>;

export function reviewFromAnalysis(
  analysis: ConversationAnalysis,
  turns: readonly Pick<Turn, "role">[],
  season: SeasonContext,
): ConversationReview {
  const knownEpisodes = new Set(season.episodes.map((episode) => episode.id));
  const difficulties = analysis.difficulties.map((difficulty, index) => {
    const turn = difficulty.turn ?? null;
    const turnIndex = turn !== null && turn < turns.length ? turn : null;
    const role = turnIndex === null ? null : turns[turnIndex]?.role;
    const kind: DifficultyKind =
      role === "tutor" ? "tutor" : difficulty.kind === "tutor" ? "vocabulary" : difficulty.kind;
    return {
      id: `d${index}`,
      kind,
      turnIndex,
      said: kind === "tutor" ? null : difficulty.said,
      target: difficulty.target,
      translation: difficulty.translation,
      why: difficulty.why,
      theme: difficulty.theme,
      episodeId:
        difficulty.episodeId && knownEpisodes.has(difficulty.episodeId) ? difficulty.episodeId : null,
      episodeTitle: difficulty.episodeTitle,
    };
  });
  return {
    summary: analysis.summary,
    score: analysis.score,
    strengths: analysis.strengths,
    improvements: analysis.improvements,
    phrases: difficulties.flatMap((difficulty) =>
      difficulty.kind === "grammar" && difficulty.said
        ? [{ wrong: difficulty.said, right: difficulty.target, why: difficulty.why }]
        : [],
    ),
    difficulties,
  };
}

export function correctedTurns(
  analysis: ConversationAnalysis,
  turns: readonly Pick<Turn, "id" | "role" | "text">[],
): { turnId: string; text: string }[] {
  return analysis.corrected.flatMap((entry) => {
    const turn = turns[entry.turn];
    return turn && turn.role === "user" && turn.text !== entry.text
      ? [{ turnId: turn.id, text: entry.text }]
      : [];
  });
}

export function selectMarkedTerms(
  marks: readonly { turnId: string; text: string }[],
  turns: readonly Pick<Turn, "id" | "text">[],
): { turnId: string; term: string; sentence: string }[] {
  const seen = new Set<string>();
  return marks
    .flatMap((mark) => {
      const term = mark.text.trim().replace(/\s+/g, " ");
      const turn = turns.find((candidate) => candidate.id === mark.turnId);
      const key = term.toLowerCase();
      if (!turn || term === "" || term.length > MAX_MARKED_TERM_LENGTH || seen.has(key)) return [];
      if (!turn.text.toLowerCase().includes(key)) return [];
      seen.add(key);
      return [{ turnId: turn.id, term, sentence: turn.text }];
    })
    .slice(0, MAX_MARKED_TERMS);
}

export function resolveTheme(
  themeId: string,
  customTopic: string | null,
  language: StudyLanguage,
): { id: string; title: string; opener: string } | null {
  if (themeId === CUSTOM_THEME_ID) {
    const topic = cleanLlmText(customTopic, MAX_TOPIC_LENGTH);
    if (!topic) return null;
    return { id: CUSTOM_THEME_ID, title: topic, opener: CUSTOM_OPENERS[language](topic) };
  }
  const theme = THEMES.find((candidate) => candidate.id === themeId);
  const opener = OPENERS[language][themeId];
  return theme && opener ? { id: theme.id, title: theme.topic, opener } : null;
}

export type LearnerProfile = {
  mistakes: string[];
  improvements: string[];
  strengths: string[];
  recentTopics: string[];
  averageScore: number | null;
};

const PROFILE_SESSIONS = 5;
const PROFILE_POINTS = 4;
const PROFILE_TOPICS = 4;

function distinct(values: readonly string[], max: number): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    kept.push(value.trim());
    if (kept.length >= max) break;
  }
  return kept;
}

export function buildLearnerProfile(input: {
  sessions: readonly Pick<Session, "themeTitle" | "review">[];
  mistakes: readonly string[];
}): LearnerProfile {
  const reviewed = input.sessions
    .flatMap((session) => (session.review ? [session.review] : []))
    .slice(0, PROFILE_SESSIONS);
  const scores = reviewed.map((review) => review.score);
  return {
    mistakes: distinct(input.mistakes, PROFILE_POINTS),
    improvements: distinct(
      reviewed.flatMap((review) => review.improvements),
      PROFILE_POINTS,
    ),
    strengths: distinct(
      reviewed.flatMap((review) => review.strengths),
      PROFILE_POINTS,
    ),
    recentTopics: distinct(
      input.sessions.map((session) => session.themeTitle),
      PROFILE_TOPICS,
    ),
    averageScore:
      scores.length === 0 ? null : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
  };
}

export function isEmptyProfile(profile: LearnerProfile): boolean {
  return (
    profile.mistakes.length === 0 &&
    profile.improvements.length === 0 &&
    profile.strengths.length === 0 &&
    profile.averageScore === null
  );
}

export function suggestTheme(recentThemeIds: readonly string[]): Theme {
  const unused = THEMES.find((theme) => !recentThemeIds.includes(theme.id));
  if (unused) return unused;
  const lastUse = (theme: Theme) => recentThemeIds.indexOf(theme.id);
  return [...THEMES].sort((a, b) => lastUse(b) - lastUse(a))[0] ?? (THEMES[0] as Theme);
}
