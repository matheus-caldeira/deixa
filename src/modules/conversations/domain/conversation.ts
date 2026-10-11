import { z } from "zod";
import { cleanLlmText } from "@/shared/llm-text";

export type ThemeIcon = "coffee" | "brief" | "bed" | "film" | "chat" | "target" | "scale" | "spark";
export type Theme = { id: string; icon: ThemeIcon; title: string; detail: string; opener: string };

export const THEMES: readonly Theme[] = [
  {
    id: "daily",
    icon: "coffee",
    title: "Dia a dia",
    detail: "Rotina, casa, fim de semana, planos.",
    opener: "Hi! How's your day going so far?",
  },
  {
    id: "work",
    icon: "brief",
    title: "Trabalho e estudos",
    detail: "Projetos, reuniões, carreira, faculdade.",
    opener: "Hey! What are you working on these days?",
  },
  {
    id: "travel",
    icon: "bed",
    title: "Viagens",
    detail: "Lugares, perrengues, próximos destinos.",
    opener: "Hi there! What's the best trip you've ever taken?",
  },
  {
    id: "shows",
    icon: "film",
    title: "Séries e filmes",
    detail: "O que você está assistindo e o que achou.",
    opener: "Hey! What have you been watching lately?",
  },
  {
    id: "food",
    icon: "target",
    title: "Comida",
    detail: "Restaurantes, receitas, o que você gosta.",
    opener: "Hi! What's your favorite thing to eat when you go out?",
  },
  {
    id: "opinions",
    icon: "scale",
    title: "Opiniões e debates",
    detail: "Defender um ponto, concordar e discordar.",
    opener: "Hi! Here's a question: is it better to work from home or at the office?",
  },
];

export const CUSTOM_THEME_ID = "custom";
export const MAX_TOPIC_LENGTH = 60;
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_USER_TURNS = 40;
export const MAX_AUDIO_BYTES = 1_500_000;
export const MIN_TURNS_FOR_XP = 3;
export const CONVERSATION_XP = 15;
export const HISTORY_TURNS_SENT = 16;

export type Correction = { wrong: string; right: string; why: string };
export type TurnRole = "user" | "tutor";
export type Turn = {
  id: string;
  role: TurnRole;
  text: string;
  translation: string | null;
  corrections: Correction[];
  createdAt: Date;
};

export type ConversationReview = {
  summary: string;
  score: number;
  strengths: string[];
  improvements: string[];
  phrases: Correction[];
};

export type Session = {
  id: string;
  themeId: string;
  themeTitle: string;
  level: string;
  review: ConversationReview | null;
  createdAt: Date;
};

const plain = (max: number) =>
  z.unknown().transform((value, context) => {
    const cleaned = cleanLlmText(value, max);
    if (!cleaned) {
      context.addIssue({ code: "custom", message: "texto inválido" });
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

export const conversationReviewSchema = z.object({
  summary: plain(600),
  score: z.number().min(0).max(100).transform(Math.round),
  strengths: tolerantList(plain(200), 5),
  improvements: tolerantList(plain(200), 5),
  phrases: tolerantList(correctionSchema, 8),
});

export function resolveTheme(
  themeId: string,
  customTopic: string | null,
): { id: string; title: string; opener: string } | null {
  if (themeId === CUSTOM_THEME_ID) {
    const topic = cleanLlmText(customTopic, MAX_TOPIC_LENGTH);
    if (!topic) return null;
    return {
      id: CUSTOM_THEME_ID,
      title: topic,
      opener: `Hi! Let's talk about ${topic}. What would you like to say about it?`,
    };
  }
  const theme = THEMES.find((candidate) => candidate.id === themeId);
  return theme ? { id: theme.id, title: theme.title, opener: theme.opener } : null;
}
