import { z } from "zod";

export const MAX_DAILY_DOWNLOADS = 1000;

const BLOCKED_HOSTS = /^(0\.0\.0\.0|169\.254\.\d+\.\d+|\[?fe80:.*|\[?::\]?|metadata\.google\.internal)$/i;

function isPlainServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const bare = url.username === "" && url.password === "" && url.search === "" && url.hash === "";
    return bare && !BLOCKED_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

const FAIL_CLOSED: Partial<AppSettings> = { subtitleDownloadsPerUserPerDay: 0, kokoroUrl: null };

export const appSettingsSchema = z.object({
  geminiModel: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{2,59}$/),
  subtitleDownloadsPerUserPerDay: z.number().int().min(0).max(MAX_DAILY_DOWNLOADS),
  kokoroUrl: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .refine(isPlainServiceUrl)
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
    else if (key in FAIL_CLOSED) merged[key] = FAIL_CLOSED[key];
  }
  return appSettingsSchema.parse(merged);
}
