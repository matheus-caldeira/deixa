import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { appSettingsSchema, mergeSettings, type AppSettings, type SettingKey } from "../domain/settings";

export interface SettingsRepository {
  load(): Promise<Partial<Record<SettingKey, unknown>>>;
  save(values: AppSettings, updatedBy: string, now: Date): Promise<void>;
}

type Deps = { settings: SettingsRepository; defaults: AppSettings; clock: Clock };

export function makeGetSettings(deps: Pick<Deps, "settings" | "defaults">) {
  return async function getSettings(): Promise<AppSettings> {
    return mergeSettings(deps.defaults, await deps.settings.load());
  };
}

export function makeUpdateSettings(deps: Deps) {
  return async function updateSettings(input: {
    actor: { userId: string; isAdmin: boolean };
    values: unknown;
  }): Promise<AppSettings> {
    if (!input.actor.isAdmin) {
      throw new AppError("FORBIDDEN", "Só o administrador altera as configurações do servidor.");
    }
    const parsed = appSettingsSchema.safeParse(input.values);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_INPUT",
        "Confira os valores: nome do modelo em minúsculas, downloads entre 0 e 1000 e endereço do Kokoro começando com http.",
      );
    }
    await deps.settings.save(parsed.data, input.actor.userId, deps.clock.now());
    return parsed.data;
  };
}
