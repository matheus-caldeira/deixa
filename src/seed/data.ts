import type { ProfileSnapshot } from "@/modules/gamification";
import type { Accent } from "@/modules/identity";
import type { CefrLevel } from "@/shared/levels";

export const SEED_EMAIL_SUFFIX = "@deixa.example";
export const SEED_PASSWORD = "deixa1234";

export type EpisodeKey = `${string}-${number}-${number}`;

export type SeedProfile = {
  slug: string;
  name: string;
  color: string;
  level: CefrLevel;
  dailyGoal: number;
  accent: Accent;
  audioSpeed: number;
  currentEpisode: EpisodeKey;
  scenesDone: number;
  progress: Record<EpisodeKey, number>;
  premarks: [number, string][];
  prelines: number[];
  reviews: { en: string; pt: string; episode: EpisodeKey }[];
  snapshot: ProfileSnapshot;
};

const skills = (listening: number, vocabulary: number, grammar: number, speaking: number) => [
  { name: "Escuta", percent: listening },
  { name: "Vocabulário", percent: vocabulary },
  { name: "Gramática", percent: grammar },
  { name: "Conversação", percent: speaking },
];

export const SEED_PROFILES: readonly SeedProfile[] = [
  {
    slug: "ana",
    name: "Ana",
    color: "#E0533D",
    level: "A1",
    dailyGoal: 50,
    accent: "US",
    audioSpeed: 0.8,
    currentEpisode: "friends-1-2",
    scenesDone: 1,
    progress: { "friends-1-1": 100, "friends-1-2": 35, "prada-0-1": 10 },
    premarks: [
      [0, "tonight"],
      [6, "disaster"],
      [12, "college"],
      [14, "pretend"],
      [20, "tomorrow"],
    ],
    prelines: [8],
    reviews: [
      { en: "Good morning!", pt: "Bom dia!", episode: "friends-1-1" },
      { en: "How are you?", pt: "Como você está?", episode: "friends-1-1" },
      { en: "I'm hungry.", pt: "Estou com fome.", episode: "friends-1-2" },
      { en: "Thank you so much.", pt: "Muito obrigada.", episode: "friends-1-1" },
      { en: "Excuse me.", pt: "Com licença.", episode: "prada-0-1" },
      { en: "Me too.", pt: "Eu também.", episode: "friends-1-2" },
    ],
    snapshot: {
      tagline: "Começando do zero, com legenda em português ao lado",
      levelPct: 64,
      streak: 3,
      longest: 5,
      freezes: 1,
      xpToday: 30,
      totalXp: 420,
      learned: 38,
      accuracy: 81,
      weekly: [0, 25, 40, 0, 35, 50, 30],
      heat: "0001230100120000130012012300112012",
      skills: skills(42, 58, 35, 20),
      achievements: ["first", "streak3"],
      heroLine: "See you later!",
      nodeDone: 2,
      trail: [
        { tc: "00:00:41", nm: "Cumprimentos", ic: "quote" },
        { tc: "00:03:12", nm: "No café", ic: "coffee" },
        { tc: "00:06:55", nm: "Primeiras frases", ic: "quote" },
        { tc: "00:10:20", nm: "Escuta lenta", ic: "ear" },
        { tc: "00:14:08", nm: "Monte a frase", ic: "pen" },
        { tc: "00:21:30", nm: "Fim do episódio", ic: "chest" },
      ],
      missions: [
        { icon: "cards", title: "Revise 10 cartões", value: 4, max: 10 },
        { icon: "ear", title: "Complete 1 lição de escuta", value: 0, max: 1 },
        { icon: "chat", title: "Converse 5 min com o tutor", value: 0, max: 5 },
      ],
      recurringErrors: [
        { label: '"tired" × "tiring"', count: "3 erros" },
        { label: 'ordem de perguntas com "are you"', count: "2 erros" },
      ],
      nextStep: "Próximo passo: entender frases curtas sem legenda em português.",
    },
  },
  {
    slug: "matheus",
    name: "Matheus",
    color: "#2F43D6",
    level: "B1",
    dailyGoal: 150,
    accent: "US",
    audioSpeed: 1,
    currentEpisode: "himym-1-3",
    scenesDone: 2,
    progress: {
      "himym-1-1": 100,
      "himym-1-2": 100,
      "himym-1-3": 60,
      "friends-1-1": 100,
      "friends-1-2": 100,
      "friends-1-3": 80,
      "office-1-1": 45,
    },
    premarks: [
      [1, "catch up on"],
      [9, "picked up the tab"],
      [10, "beat yourself up"],
      [16, "ran into"],
    ],
    prelines: [22],
    reviews: [
      { en: "figure it out", pt: "descobrir / resolver", episode: "himym-1-2" },
      { en: "I owe you one.", pt: "Fico te devendo essa.", episode: "himym-1-1" },
      { en: "run into someone", pt: "encontrar alguém por acaso", episode: "himym-1-3" },
      { en: "No way!", pt: "Não acredito! / De jeito nenhum!", episode: "friends-1-3" },
      { en: "call it a night", pt: "encerrar a noite", episode: "himym-1-3" },
      { en: "What a small world.", pt: "Que mundo pequeno.", episode: "office-1-1" },
    ],
    snapshot: {
      tagline: "Entende quase tudo com legenda; quer largar a legenda",
      levelPct: 38,
      streak: 7,
      longest: 21,
      freezes: 2,
      xpToday: 120,
      totalXp: 6840,
      learned: 412,
      accuracy: 88,
      weekly: [160, 150, 170, 90, 155, 210, 120],
      heat: "2321332233213223332132333223322333",
      skills: skills(66, 72, 61, 48),
      achievements: ["first", "streak3", "streak7", "phrasal25", "ep10"],
      heroLine: "What are you up to tonight?",
      nodeDone: 3,
      trail: [
        { tc: "00:01:05", nm: "Convites e planos", ic: "quote" },
        { tc: "00:04:40", nm: "Phrasal verbs do bar", ic: "beer" },
        { tc: "00:08:12", nm: "Contrações faladas", ic: "ear" },
        { tc: "00:12:31", nm: "Ditado sem legenda", ic: "pen" },
        { tc: "00:16:50", nm: "Gírias do episódio", ic: "quote" },
        { tc: "00:21:02", nm: "Desafio final", ic: "chest" },
      ],
      missions: [
        { icon: "cards", title: "Revise 10 cartões", value: 4, max: 10 },
        { icon: "ear", title: "Complete 1 lição de escuta", value: 0, max: 1 },
        { icon: "chat", title: "Converse 5 min com o tutor", value: 2, max: 5 },
      ],
      recurringErrors: [
        { label: '"hang out" × "hang up"', count: "4 erros" },
        { label: 'falso cognato "support"', count: "2 erros" },
      ],
      nextStep: "Próximo passo: acompanhar conversas rápidas com legenda só em inglês.",
    },
  },
  {
    slug: "lucas",
    name: "Lucas",
    color: "#0F9E73",
    level: "C1",
    dailyGoal: 250,
    accent: "UK",
    audioSpeed: 1.15,
    currentEpisode: "tedlasso-1-2",
    scenesDone: 3,
    progress: {
      "tedlasso-1-1": 100,
      "tedlasso-1-2": 70,
      "office-1-1": 100,
      "office-1-2": 100,
      "bb-1-1": 100,
      "socialnetwork-0-1": 55,
    },
    premarks: [
      [15, "play it cool"],
      [4, "first round's on me"],
      [19, "dude"],
    ],
    prelines: [],
    reviews: [
      { en: "I reckon", pt: "acho que (informal, Reino Unido)", episode: "tedlasso-1-1" },
      { en: "take the mickey", pt: "zoar, tirar sarro (Reino Unido)", episode: "tedlasso-1-2" },
      { en: "a tall order", pt: "uma tarefa difícil", episode: "socialnetwork-0-1" },
      { en: "off the record", pt: "em off, extraoficialmente", episode: "tedlasso-1-3" },
      { en: "to be fair", pt: "para ser justo", episode: "tedlasso-1-2" },
      { en: "to cut corners", pt: "fazer de qualquer jeito para economizar", episode: "bb-1-1" },
    ],
    snapshot: {
      tagline: "Assiste sem legenda; foca em sotaque, ironia e registro",
      levelPct: 22,
      streak: 41,
      longest: 41,
      freezes: 0,
      xpToday: 260,
      totalXp: 24310,
      learned: 1890,
      accuracy: 93,
      weekly: [280, 240, 310, 265, 300, 255, 260],
      heat: "3333233333332333333333333233333333",
      skills: skills(88, 91, 84, 79),
      achievements: ["first", "streak3", "streak7", "streak30", "phrasal25", "ep10", "nosub", "tutor10"],
      heroLine: "Fair enough.",
      nodeDone: 4,
      trail: [
        { tc: "00:02:18", nm: "Sotaque britânico", ic: "ear" },
        { tc: "00:07:44", nm: "Ironia e subtexto", ic: "quote" },
        { tc: "00:12:09", nm: "Registro formal", ic: "brief" },
        { tc: "00:17:35", nm: "Expressões idiomáticas", ic: "quote" },
        { tc: "00:22:50", nm: "Escrita diplomática", ic: "pen" },
        { tc: "00:28:11", nm: "Desafio final", ic: "chest" },
      ],
      missions: [
        { icon: "cards", title: "Revise 10 cartões", value: 10, max: 10 },
        { icon: "ear", title: "Complete 1 lição de escuta", value: 1, max: 1 },
        { icon: "chat", title: "Converse 5 min com o tutor", value: 5, max: 5 },
      ],
      recurringErrors: [
        { label: '"I reckon" em contexto formal', count: "2 erros" },
        { label: "ironia britânica", count: "1 erro" },
      ],
      nextStep: "Próximo passo: entender subtexto e sotaques variados sem legenda.",
    },
  },
];

export type SeedEpisodeState = "READY_PT" | "READY_EN" | "PROCESSING" | "NEEDS_REVIEW";

export const SEED_WORKS: readonly {
  slug: string;
  title: string;
  year: number;
  type: "series" | "movie";
  levels: readonly [CefrLevel, CefrLevel];
  accent: string;
  uploader: string;
  episodes: Record<EpisodeKey, SeedEpisodeState>;
}[] = [
  {
    slug: "friends",
    title: "Friends",
    year: 1994,
    type: "series",
    levels: ["A1", "B1"],
    accent: "EUA",
    uploader: "matheus",
    episodes: {
      "friends-1-1": "READY_PT",
      "friends-1-2": "READY_PT",
      "friends-1-3": "READY_PT",
      "friends-1-4": "PROCESSING",
    },
  },
  {
    slug: "himym",
    title: "How I Met Your Mother",
    year: 2005,
    type: "series",
    levels: ["A2", "B2"],
    accent: "EUA",
    uploader: "matheus",
    episodes: {
      "himym-1-1": "READY_PT",
      "himym-1-2": "READY_PT",
      "himym-1-3": "READY_PT",
      "himym-1-4": "READY_PT",
      "himym-1-5": "NEEDS_REVIEW",
    },
  },
  {
    slug: "office",
    title: "The Office",
    year: 2005,
    type: "series",
    levels: ["B1", "C1"],
    accent: "EUA",
    uploader: "lucas",
    episodes: { "office-1-1": "READY_PT", "office-1-2": "READY_EN", "office-1-3": "PROCESSING" },
  },
  {
    slug: "tedlasso",
    title: "Ted Lasso",
    year: 2020,
    type: "series",
    levels: ["B2", "C2"],
    accent: "EUA + Reino Unido",
    uploader: "lucas",
    episodes: { "tedlasso-1-1": "READY_PT", "tedlasso-1-2": "READY_PT", "tedlasso-1-3": "READY_EN" },
  },
  {
    slug: "bb",
    title: "Breaking Bad",
    year: 2008,
    type: "series",
    levels: ["B2", "C1"],
    accent: "EUA",
    uploader: "lucas",
    episodes: { "bb-1-1": "READY_EN" },
  },
  {
    slug: "prada",
    title: "The Devil Wears Prada",
    year: 2006,
    type: "movie",
    levels: ["B1", "B2"],
    accent: "EUA",
    uploader: "ana",
    episodes: { "prada-0-1": "READY_PT" },
  },
  {
    slug: "socialnetwork",
    title: "The Social Network",
    year: 2010,
    type: "movie",
    levels: ["C1", "C2"],
    accent: "EUA",
    uploader: "lucas",
    episodes: { "socialnetwork-0-1": "READY_EN" },
  },
];

export const SHARED_MARKS: readonly {
  episode: EpisodeKey;
  by: string[];
  marks: [number, string][];
  lines: number[];
}[] = [
  {
    episode: "himym-1-3",
    by: ["ana", "lucas"],
    marks: [
      [1, "catch up on"],
      [9, "picked up the tab"],
      [10, "beat yourself up"],
    ],
    lines: [],
  },
  { episode: "himym-1-3", by: ["lucas"], marks: [[15, "play it cool"]], lines: [] },
];
