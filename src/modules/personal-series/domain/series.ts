import { z } from "zod";
import { cleanLlmText } from "@/shared/llm-text";
import { CEFR_LEVELS, levelIndex, nextLevel, type CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";

export const LEVEL_MODES = ["auto", "fixed", "custom"] as const;
export type LevelMode = (typeof LEVEL_MODES)[number];

export const CARDS_PER_NODE = 4;
export const MAX_CARDS_PER_EPISODE = 12;
export const NEXT_SEASON_AT_PERCENT = 80;
export const FRESH_EPISODE_MS = 3 * 24 * 60 * 60 * 1000;
export const MAX_SERIES_NAME = 40;
export const MAX_SERIES_DESCRIPTION = 500;
export const MAX_THEME_KEY = 40;
const MAX_EPISODE_TITLE = 60;
const UPCOMING_THEMES = 3;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export type SeriesLevel = { mode: LevelMode; min: CefrLevel | null; max: CefrLevel | null };

export type Series = {
  id: string;
  userId: string;
  pair: LanguagePair;
  name: string | null;
  description: string | null;
  descriptionUpdatedAt: Date | null;
  descriptionBasis: { conversations: number; cards: number } | null;
  level: SeriesLevel;
  startLevel: CefrLevel;
  createdAt: Date;
};

export type Season = { id: string; number: number; level: CefrLevel };

export type Episode = {
  id: string;
  seasonId: string;
  number: number;
  title: string;
  theme: string;
  part: number;
  cardCount: number;
  sourceCount: number;
  createdAt: Date;
};

export type EpisodeCard = { learningItemId: string; term: string; translation: string | null };

export function normalizeTheme(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_THEME_KEY);
}

export function romanNumeral(part: number): string {
  return ROMAN[part - 1] ?? String(part);
}

function clampLevel(level: CefrLevel, min: CefrLevel | null, max: CefrLevel | null): CefrLevel {
  const low = min ? levelIndex(min) : 0;
  const high = max ? levelIndex(max) : CEFR_LEVELS.length - 1;
  return CEFR_LEVELS[Math.min(high, Math.max(low, levelIndex(level)))] ?? level;
}

function baseLevel(level: SeriesLevel, userLevel: CefrLevel): CefrLevel {
  if (level.mode === "fixed") return level.min ?? userLevel;
  if (level.mode === "custom") return clampLevel(userLevel, level.min, level.max);
  return userLevel;
}

function allowedNext(level: SeriesLevel, from: CefrLevel): CefrLevel | null {
  if (level.mode === "fixed") return null;
  const next = nextLevel(from);
  if (!next) return null;
  if (level.mode === "custom" && level.max && levelIndex(next) > levelIndex(level.max)) return null;
  return next;
}

export function activeLevel(input: {
  level: SeriesLevel;
  userLevel: CefrLevel;
  levelPct: number;
}): CefrLevel {
  const base = baseLevel(input.level, input.userLevel);
  if (input.levelPct < NEXT_SEASON_AT_PERCENT) return base;
  return allowedNext(input.level, base) ?? base;
}

export function upcomingSeason(input: {
  level: SeriesLevel;
  userLevel: CefrLevel;
  levelPct: number;
  seasons: readonly Season[];
  episodes: readonly Episode[];
}): { level: CefrLevel; percent: number; unlockAt: number; themes: string[] } | null {
  const active = activeLevel(input);
  if (active !== baseLevel(input.level, input.userLevel)) return null;
  const next = allowedNext(input.level, active);
  if (!next || input.seasons.some((season) => season.level === next)) return null;
  const activeSeason = input.seasons.find((season) => season.level === active);
  const themes = input.episodes
    .filter((episode) => episode.seasonId === activeSeason?.id)
    .sort((a, b) => b.cardCount - a.cardCount)
    .map((episode) => episode.title.replace(/\s+[IVX]+(?=:|$).*$/, ""))
    .filter((title, index, all) => title !== "" && all.indexOf(title) === index)
    .slice(0, UPCOMING_THEMES);
  return {
    level: next,
    percent: input.levelPct,
    unlockAt: NEXT_SEASON_AT_PERCENT,
    themes,
  };
}

export type PlacementRequest = { key: string; theme: string; episodeId: string | null; episodeTitle: string };
export type PlacementTarget = { kind: "existing"; episodeId: string } | { kind: "new"; ref: string };
export type NewEpisodePlan = { ref: string; theme: string; part: number; title: string };

function partTitle(title: string, part: number): string {
  const base =
    title
      .replace(/\s+[IVX]+(?=:|$)/, "")
      .split(":")[0]
      ?.trim() || title;
  return `${base} ${romanNumeral(part)}`.slice(0, MAX_EPISODE_TITLE);
}

export function planPlacements(input: {
  episodes: readonly Pick<Episode, "id" | "theme" | "part" | "title" | "cardCount">[];
  requests: readonly PlacementRequest[];
}): { assignments: { key: string; target: PlacementTarget }[]; newEpisodes: NewEpisodePlan[] } {
  type Slot = { target: PlacementTarget; theme: string; part: number; title: string; count: number };
  const slots: Slot[] = input.episodes.map((episode) => ({
    target: { kind: "existing", episodeId: episode.id },
    theme: episode.theme,
    part: episode.part,
    title: episode.title,
    count: episode.cardCount,
  }));
  const newEpisodes: NewEpisodePlan[] = [];
  const open = (theme: string, title: string): Slot => {
    const parts = slots.filter((slot) => slot.theme === theme).map((slot) => slot.part);
    const part = parts.length === 0 ? 1 : Math.max(...parts) + 1;
    const ref = `new:${theme}:${part}`;
    const plannedTitle = part === 1 ? title.slice(0, MAX_EPISODE_TITLE) : partTitle(title, part);
    const slot: Slot = { target: { kind: "new", ref }, theme, part, title: plannedTitle, count: 0 };
    slots.push(slot);
    newEpisodes.push({ ref, theme, part, title: plannedTitle });
    return slot;
  };
  const assignments = input.requests.map((request) => {
    const named = slots.find(
      (slot) => slot.target.kind === "existing" && slot.target.episodeId === request.episodeId,
    );
    const theme =
      named?.theme ?? (normalizeTheme(request.theme) || normalizeTheme(request.episodeTitle) || "geral");
    const latest = slots.filter((slot) => slot.theme === theme).sort((a, b) => b.part - a.part)[0];
    const candidate = named && named.count < MAX_CARDS_PER_EPISODE ? named : latest;
    const slot =
      candidate && candidate.count < MAX_CARDS_PER_EPISODE
        ? candidate
        : open(theme, candidate?.title ?? request.episodeTitle);
    slot.count += 1;
    return { key: request.key, target: slot.target };
  });
  return { assignments, newEpisodes };
}

const FULL_PROGRESS = 100;

export type TrailNodeState = "done" | "current" | "locked";
export type EpisodeNode = { index: number; title: string; cardCount: number; state: TrailNodeState };

export function nodeCount(cardCount: number): number {
  return Math.ceil(cardCount / CARDS_PER_NODE);
}

export function nodeStatesFor(cardCount: number, completed: ReadonlySet<number>): TrailNodeState[] {
  const total = nodeCount(cardCount);
  let unlocked = 0;
  while (unlocked < total && completed.has(unlocked)) unlocked += 1;
  return Array.from({ length: total }, (_, index) =>
    completed.has(index) ? "done" : index === unlocked ? "current" : "locked",
  );
}

export function episodeNodes(cards: readonly EpisodeCard[], completed: ReadonlySet<number>): EpisodeNode[] {
  const states = nodeStatesFor(cards.length, completed);
  return states.map((state, index) => {
    const chunk = cards.slice(index * CARDS_PER_NODE, (index + 1) * CARDS_PER_NODE);
    return { index, title: chunk.map((card) => card.term).join(" · "), cardCount: chunk.length, state };
  });
}

export function nextEpisodeId(episodes: readonly { id: string; progress: number; cardCount: number }[]) {
  return episodes.find((episode) => episode.cardCount > 0 && episode.progress < FULL_PROGRESS)?.id ?? null;
}

export function progressPercent(cardCount: number, completed: ReadonlySet<number>): number {
  const total = nodeCount(cardCount);
  if (total === 0) return 0;
  const done = [...completed].filter((index) => index >= 0 && index < total).length;
  return Math.round((done / total) * 100);
}

export const seriesDescriptionSchema = z.object({
  description: z.unknown().transform((value, context) => {
    const cleaned = cleanLlmText(value, MAX_SERIES_DESCRIPTION);
    if (!cleaned) {
      context.addIssue({ code: "custom", message: "invalid description" });
      return z.NEVER;
    }
    return cleaned;
  }),
});

export function cleanSeriesName(name: string): string | null {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned === "") return null;
  return cleanLlmText(cleaned, MAX_SERIES_NAME);
}

export function validLevel(level: SeriesLevel): boolean {
  if (level.mode === "auto") return true;
  if (level.mode === "fixed") return level.min !== null;
  return level.min !== null && level.max !== null && levelIndex(level.min) <= levelIndex(level.max);
}
