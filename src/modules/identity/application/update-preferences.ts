import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { Locale } from "@/shared/locales";
import { AUDIO_SPEEDS, DAILY_GOALS, type Accent } from "../domain/user";
import { isCefrLevel, type CefrLevel } from "@/shared/levels";
import { pairOf } from "../domain/user";
import type { LanguagePairRepository, PreferencesRepository } from "./ports";

export type PreferencesPatch = {
  dailyGoal?: number;
  preferredAccent?: Accent;
  audioSpeed?: number;
  locale?: Locale;
  level?: CefrLevel;
  currentEpisodeId?: string;
};

export function makeUpdatePreferences(deps: {
  preferences: PreferencesRepository;
  pairs: LanguagePairRepository;
  clock: Clock;
}) {
  return async function updatePreferences(userId: string, patch: PreferencesPatch): Promise<void> {
    if (patch.dailyGoal !== undefined && !DAILY_GOALS.some((goal) => goal.xp === patch.dailyGoal)) {
      throw new AppError("INVALID_INPUT");
    }
    if (patch.audioSpeed !== undefined && !AUDIO_SPEEDS.some((speed) => speed === patch.audioSpeed)) {
      throw new AppError("INVALID_INPUT");
    }
    if (patch.level !== undefined) {
      if (!isCefrLevel(patch.level)) throw new AppError("INVALID_INPUT");
      const current = await deps.preferences.get(userId);
      if (current)
        await deps.pairs.upsertPair(userId, { ...pairOf(current), level: patch.level }, deps.clock.now());
    }
    await deps.preferences.update(userId, patch);
  };
}
