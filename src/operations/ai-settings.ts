import { z } from "zod";
import { modelChoiceSchema } from "@/modules/ai-credentials";
import { usageLimitSchema } from "@/modules/ai-usage";
import { AppError } from "@/shared/errors";
import { operation } from "./operation";

const keySchema = z.enum(["own", "shared"]);
const targetSchema = z.union([
  z.object({ scope: z.literal("own"), key: keySchema }),
  z.object({ scope: z.literal("person"), userId: z.uuid(), key: keySchema }),
]);
const defaultsSchema = z.object({
  aiGeneration: modelChoiceSchema,
  aiEmbedding: modelChoiceSchema.nullable(),
});

export const aiSettingsOperations = {
  "ai.setModels": operation({
    input: z.unknown(),
    refresh: true,
    run: ({ user, app }, models) => app.setAiModels({ userId: user.id, models }),
  }),
  "ai.assignModel": operation({
    input: z.object({ userId: z.uuid(), generation: z.unknown() }),
    refresh: true,
    run: ({ user, app }, input) =>
      app.assignAiModel({
        actor: { userId: user.id, isAdmin: user.isAdmin },
        userId: input.userId,
        generation: input.generation,
      }),
  }),
  "ai.updateDefaults": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app, refreshSettings }, input) => {
      const parsed = defaultsSchema.safeParse(input);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "modelInvalid");
      const current = await app.getSettings();
      const saved = await app.updateSettings({
        actor: { userId: user.id, isAdmin: user.isAdmin },
        values: { ...current, ...parsed.data },
      });
      await refreshSettings();
      return saved;
    },
  }),
  "ai.setUsageLimit": operation({
    input: z.object({ target: targetSchema, limit: z.unknown() }),
    refresh: true,
    run: ({ user, app }, input) =>
      app.setAiUsageLimit({
        actor: { userId: user.id, isAdmin: user.isAdmin },
        target: input.target,
        limit: input.limit,
      }),
  }),
  "ai.updateSharedLimit": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app, refreshSettings }, input) => {
      const parsed = usageLimitSchema.safeParse(input);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "limitInvalid");
      const current = await app.getSettings();
      const saved = await app.updateSettings({
        actor: { userId: user.id, isAdmin: user.isAdmin },
        values: { ...current, aiSharedLimit: parsed.data },
      });
      await refreshSettings();
      return saved.aiSharedLimit;
    },
  }),
  "ai.saveModelPrice": operation({
    input: z.unknown(),
    refresh: true,
    run: ({ user, app }, price) =>
      app.saveModelPrice({ actor: { userId: user.id, isAdmin: user.isAdmin }, price }),
  }),
};
