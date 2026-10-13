import { z } from "zod";
import { modelChoiceSchema } from "@/modules/ai-credentials";
import { usageLimitSchema } from "@/modules/ai-usage";
import { canonicalServiceUrl } from "@/shared/service-url";

export const MAX_DAILY_DOWNLOADS = 1000;

export { canonicalServiceUrl };

const FAIL_CLOSED: Partial<AppSettings> = { subtitleDownloadsPerUserPerDay: 0, kokoroUrl: null };

export const appSettingsSchema = z.object({
  aiGeneration: modelChoiceSchema,
  aiEmbedding: modelChoiceSchema.nullable(),
  aiCustomEndpointsAllowed: z.boolean(),
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
