import { z } from "zod";
import type { CefrLevel } from "@/shared/levels";

export const profileSnapshotSchema = z.object({
  tagline: z.string(),
  levelPct: z.number(),
  learnedBase: z.number(),
  accuracy: z.number(),
  skills: z.array(z.object({ name: z.string(), percent: z.number() })),
  achievements: z.array(z.string()),
  recurringErrors: z.array(z.object({ label: z.string(), count: z.string() })),
  nextStep: z.string(),
});

export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;

export const EMPTY_SNAPSHOT: ProfileSnapshot = {
  tagline: "",
  levelPct: 0,
  learnedBase: 0,
  accuracy: 0,
  skills: [
    { name: "Escuta", percent: 0 },
    { name: "Vocabulário", percent: 0 },
    { name: "Gramática", percent: 0 },
    { name: "Conversação", percent: 0 },
  ],
  achievements: [],
  recurringErrors: [],
  nextStep: "Próximo passo: ler um episódio e marcar o que você não entendeu.",
};

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  icon: "play" | "flame" | "quote" | "film" | "trophy" | "ear" | "chat" | "star";
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first", title: "Primeira cena", detail: "1ª lição concluída", icon: "play" },
  { id: "streak3", title: "Aquecendo", detail: "3 dias seguidos", icon: "flame" },
  { id: "streak7", title: "Semana cheia", detail: "7 dias seguidos", icon: "flame" },
  { id: "phrasal25", title: "Phrasal fan", detail: "25 phrasal verbs", icon: "quote" },
  { id: "ep10", title: "Maratona", detail: "10 episódios estudados", icon: "film" },
  { id: "streak30", title: "Hábito", detail: "30 dias seguidos", icon: "trophy" },
  { id: "nosub", title: "Sem legenda", detail: "Ditado 100% num episódio", icon: "ear" },
  { id: "tutor10", title: "Bom de papo", detail: "10 conversas com o tutor", icon: "chat" },
  { id: "accent", title: "Ouvido global", detail: "3 sotaques diferentes", icon: "star" },
];

export type Scenario = {
  id: string;
  icon: "coffee" | "bed" | "beer" | "brief" | "scale";
  title: string;
  level: CefrLevel;
  detail: string;
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "cafe",
    icon: "coffee",
    title: "Pedir no café",
    level: "A1",
    detail: "Pedir bebida, perguntar o preço, agradecer.",
  },
  {
    id: "hotel",
    icon: "bed",
    title: "Check-in no hotel",
    level: "A2",
    detail: "Reserva, documento, horário do café da manhã.",
  },
  {
    id: "drinks",
    icon: "beer",
    title: "Combinar um happy hour",
    level: "B1",
    detail: "Convidar, sugerir lugar, negociar horário.",
  },
  {
    id: "deadline",
    icon: "brief",
    title: "Negociar prazo com cliente",
    level: "B2",
    detail: "Explicar atraso, propor alternativa, manter a relação.",
  },
  {
    id: "disagree",
    icon: "scale",
    title: "Discordar com educação",
    level: "C1",
    detail: "Hedging, ironia leve, defender um ponto sem confronto.",
  },
];
