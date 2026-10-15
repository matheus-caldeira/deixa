export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export type LevelFit = "fit" | "challenging" | "easy";
export type DisplayMode = "both" | "tap" | "en";

const LAST_LEVEL_WITH_PORTUGUESE_ALWAYS = 1;
const LAST_LEVEL_WITH_PORTUGUESE_ON_TAP = 3;

export function levelIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);
}

export function nextLevel(level: CefrLevel): CefrLevel | null {
  return CEFR_LEVELS[levelIndex(level) + 1] ?? null;
}

export function fitFor(userLevel: CefrLevel, min: CefrLevel, max: CefrLevel): LevelFit {
  const user = levelIndex(userLevel);
  if (user < levelIndex(min)) return "challenging";
  if (user > levelIndex(max)) return "easy";
  return "fit";
}

export function defaultDisplayMode(level: CefrLevel): DisplayMode {
  const index = levelIndex(level);
  if (index <= LAST_LEVEL_WITH_PORTUGUESE_ALWAYS) return "both";
  if (index <= LAST_LEVEL_WITH_PORTUGUESE_ON_TAP) return "tap";
  return "en";
}
