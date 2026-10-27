import { z } from "zod";
import { CREDENTIAL_SERVICES } from "@/modules/ai-credentials";
import { AppError } from "@/shared/errors";
import { localeSchema } from "@/shared/locales";
import { CEFR_LEVELS } from "@/shared/levels";
import { studyLanguageSchema } from "@/shared/study-languages";
import { operation } from "./operation";

const MAX_SECRET_CHARS = 1000;

export const preferencesSchema = z
  .object({
    dailyGoal: z.number().int().optional(),
    preferredAccent: z.enum(["US", "UK"]).optional(),
    audioSpeed: z.number().optional(),
    locale: localeSchema.optional(),
  })
  .strict();

const credentialTarget = z.object({
  service: z.enum(CREDENTIAL_SERVICES),
  scope: z.enum(["user", "global"]),
});
const pairSchema = z.object({ target: studyLanguageSchema, native: studyLanguageSchema });

export const profileOperations = {
  "profile.updatePreferences": operation({
    input: preferencesSchema,
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.updatePreferences(user.id, input);
      return null;
    },
  }),
  "profile.saveCredential": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app }, input) => {
      const parsed = credentialTarget
        .extend({ secret: z.string().min(1).max(MAX_SECRET_CHARS) })
        .safeParse(input);
      if (!parsed.success) throw new AppError("AI_KEY_INVALID");
      return app.saveCredential({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...parsed.data });
    },
  }),
  "profile.removeCredential": operation({
    input: credentialTarget,
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.removeCredential({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...input });
      return null;
    },
  }),
  "profile.updateSettings": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app, refreshSettings }, values) => {
      const saved = await app.updateSettings({ actor: { userId: user.id, isAdmin: user.isAdmin }, values });
      await refreshSettings();
      return saved;
    },
  }),
  "profile.switchPair": operation({
    input: pairSchema,
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.switchLanguagePair(user.id, input);
      return null;
    },
  }),
  "profile.addPair": operation({
    input: pairSchema.extend({ level: z.enum(CEFR_LEVELS) }),
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.addLanguagePair(user.id, input);
      return null;
    },
  }),
};
