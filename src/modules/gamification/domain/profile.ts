export const SKILLS = ["listening", "vocabulary", "grammar", "conversation"] as const;
export type Skill = (typeof SKILLS)[number];

export type KindStats = Record<string, { correct: number; total: number }>;

export type SkillSources = {
  lessons: { correct: number; total: number; byKind: KindStats };
  reviews: { total: number; again: number };
  conversationScores: number[];
};

const PERCENT = 100;
const LISTENING_KINDS = ["listen", "type"];
const GRAMMAR_KINDS = ["order", "blank"];
const VOCABULARY_KINDS = ["choice"];
export const LESSONS_PER_LEVEL = 12;
export const CARDS_PER_LEVEL = 80;
const LESSONS_WEIGHT = 0.5;
const CARDS_WEIGHT = 0.5;

const ratio = (correct: number, total: number): number | null => (total > 0 ? correct / total : null);
const percent = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * PERCENT);

function accuracyOfKinds(byKind: KindStats, kinds: readonly string[]): number | null {
  let correct = 0;
  let total = 0;
  for (const kind of kinds) {
    correct += byKind[kind]?.correct ?? 0;
    total += byKind[kind]?.total ?? 0;
  }
  return ratio(correct, total);
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function skillPercents(sources: SkillSources): { key: Skill; percent: number }[] {
  const listening = accuracyOfKinds(sources.lessons.byKind, LISTENING_KINDS);
  const grammar = accuracyOfKinds(sources.lessons.byKind, GRAMMAR_KINDS);
  const meaning = accuracyOfKinds(sources.lessons.byKind, VOCABULARY_KINDS);
  const retention = sources.reviews.total > 0 ? 1 - sources.reviews.again / sources.reviews.total : null;
  const vocabulary = average([meaning, retention].filter((value): value is number => value !== null));
  const conversation = average(sources.conversationScores);
  return [
    { key: "listening", percent: percent(listening ?? 0) },
    { key: "vocabulary", percent: percent(vocabulary ?? 0) },
    { key: "grammar", percent: percent(grammar ?? 0) },
    { key: "conversation", percent: conversation === null ? 0 : Math.round(conversation) },
  ];
}

export function overallAccuracy(sources: Pick<SkillSources, "lessons" | "reviews">): number {
  const correct = sources.lessons.correct + (sources.reviews.total - sources.reviews.again);
  const total = sources.lessons.total + sources.reviews.total;
  return percent(ratio(correct, total) ?? 0);
}

export function levelProgressPercent(input: { lessonsPassed: number; cardsOwned: number }): number {
  const lessons = Math.min(1, input.lessonsPassed / LESSONS_PER_LEVEL);
  const cards = Math.min(1, input.cardsOwned / CARDS_PER_LEVEL);
  return percent(lessons * LESSONS_WEIGHT + cards * CARDS_WEIGHT);
}

export type AchievementIcon = "play" | "flame" | "quote" | "film" | "trophy" | "ear" | "chat" | "star";
export type Achievement = { id: string; icon: AchievementIcon };

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first", icon: "play" },
  { id: "streak3", icon: "flame" },
  { id: "streak7", icon: "flame" },
  { id: "phrasal25", icon: "quote" },
  { id: "ep10", icon: "film" },
  { id: "streak30", icon: "trophy" },
  { id: "nosub", icon: "ear" },
  { id: "tutor10", icon: "chat" },
  { id: "accent", icon: "star" },
];
