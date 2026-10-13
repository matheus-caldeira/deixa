import { z } from "zod";
import { usageLimitSchema } from "@/modules/ai-usage";

export const MAX_DAILY_DOWNLOADS = 1000;

const BLOCKED_IPV4 = /^(0\.|169\.254\.)/;
const BLOCKED_NAMES = new Set(["metadata.google.internal", "metadata"]);
const LOOPBACK_IPV6 = "[::1]";

export function canonicalServiceUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") return null;
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  const isIpv6 = host.startsWith("[");
  if (host === "" || BLOCKED_IPV4.test(host) || BLOCKED_NAMES.has(host)) return null;
  if (isIpv6 && host !== LOOPBACK_IPV6) return null;
  const path = url.pathname.replace(/\/+$/, "");
  const port = url.port === "" ? "" : `:${url.port}`;
  return `${url.protocol}//${host}${port}${path}`;
}

const FAIL_CLOSED: Partial<AppSettings> = { subtitleDownloadsPerUserPerDay: 0, kokoroUrl: null };

export const appSettingsSchema = z.object({
  geminiModel: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{2,59}$/),
  subtitleDownloadsPerUserPerDay: z.number().int().min(0).max(MAX_DAILY_DOWNLOADS),
  kokoroUrl: z
    .string()
    .max(300)
    .transform((value, context) => {
      const canonical = canonicalServiceUrl(value);
      if (canonical === null) {
        context.addIssue({ code: "custom", message: "endereço de serviço inválido" });
        return z.NEVER;
      }
      return canonical;
    })
    .nullable(),
  aiSharedLimit: usageLimitSchema,
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
