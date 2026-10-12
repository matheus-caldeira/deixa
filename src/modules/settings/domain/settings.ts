import { z } from "zod";

export const MAX_DAILY_DOWNLOADS = 1000;

export const appSettingsSchema = z.object({
  geminiModel: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{2,59}$/),
  subtitleDownloadsPerUserPerDay: z.number().int().min(0).max(MAX_DAILY_DOWNLOADS),
  kokoroUrl: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .nullable(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type SettingKey = keyof AppSettings;

export const SETTING_KEYS = Object.keys(appSettingsSchema.shape) as SettingKey[];

export function mergeSettings(
  defaults: AppSettings,
  stored: Partial<Record<SettingKey, unknown>>,
): AppSettings {
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of SETTING_KEYS) {
    if (!(key in stored)) continue;
    const parsed = appSettingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success) merged[key] = parsed.data;
  }
  return appSettingsSchema.parse(merged);
}
