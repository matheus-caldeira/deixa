import { AppError } from "@/shared/errors";
import { AUDIO_SPEEDS, DAILY_GOALS, type Accent } from "../domain/user";
import type { PreferencesRepository } from "./ports";

export type PreferencesPatch = {
  dailyGoal?: number;
  preferredAccent?: Accent;
  audioSpeed?: number;
  currentEpisodeId?: string;
};

export function makeUpdatePreferences(deps: { preferences: PreferencesRepository }) {
  return async function updatePreferences(userId: string, patch: PreferencesPatch): Promise<void> {
    if (patch.dailyGoal !== undefined && !DAILY_GOALS.some((goal) => goal.xp === patch.dailyGoal)) {
      throw new AppError("INVALID_INPUT");
    }
    if (patch.audioSpeed !== undefined && !AUDIO_SPEEDS.some((speed) => speed === patch.audioSpeed)) {
      throw new AppError("INVALID_INPUT");
    }
    await deps.preferences.update(userId, patch);
  };
}
