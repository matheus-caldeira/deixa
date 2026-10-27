import { z } from "zod";
import type { Container } from "@/infrastructure/container";
import { episodeLabel } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { AppError } from "@/shared/errors";
import type { LanguagePair } from "@/shared/study-languages";
import { operation } from "./operation";
import { routes } from "@/shared/routes";

const MAX_MARKED_CUES = 2000;
const MAX_TOKENS_PER_CUE = 200;
const idSchema = z.uuid();
const marksSchema = z
  .array(
    z.object({
      cueId: idSchema,
      tokens: z.array(z.number().int().min(0).max(1000)).max(MAX_TOKENS_PER_CUE),
      wholeLine: z.boolean(),
    }),
  )
  .max(MAX_MARKED_CUES);
const syncSchema = z.object({ episodeId: idSchema, marks: marksSchema });

export type SavedHighlightView = {
  cueId: string;
  startToken: number;
  endToken: number;
  kind: "word" | "phrase" | "line";
  carded: boolean;
};

async function sync(
  app: Container,
  userId: string,
  pair: LanguagePair,
  input: z.infer<typeof syncSchema>,
): Promise<SavedHighlightView[]> {
  const highlights = await app.syncHighlights({ userId, pair, ...input });
  return highlights.map((highlight) => ({
    cueId: highlight.cueId,
    startToken: highlight.startToken,
    endToken: highlight.endToken,
    kind: highlight.kind,
    carded: highlight.cardBatchId !== null,
  }));
}

export const readingOperations = {
  "reading.syncHighlights": operation({
    input: syncSchema,
    run: ({ user, app }, input) => sync(app, user.id, pairOf(user.preferences), input),
  }),
  "reading.startCardGeneration": operation({
    input: syncSchema,
    run: async ({ user, app, schedule }, input) => {
      await sync(app, user.id, pairOf(user.preferences), input);
      const context = await app.getEpisodeContext(input.episodeId);
      if (!context) throw new AppError("EPISODE_NOT_FOUND");
      const { batchId } = await app.requestCardDrafts({ userId: user.id, episodeId: input.episodeId });
      await schedule("card_batch", {
        userId: user.id,
        episodeId: input.episodeId,
        batchId,
        learnerLevel: user.preferences.level,
        pair: pairOf(user.preferences),
        episodeLabel: `${context.media.title} · ${episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)}`,
      });
      return { batchId };
    },
  }),
  "reading.cardBatch": operation({
    input: z.unknown(),
    run: async ({ user, app }, batchId) => {
      const parsed = idSchema.safeParse(batchId);
      if (!parsed.success) throw new AppError("BATCH_NOT_FOUND");
      const state = await app.getCardBatch(user.id, parsed.data);
      if (state.status === "DRAFT" || state.status === "SAVED") {
        await app.markNotificationsRead(user.id, { href: routes.read(state.episodeId, state.batchId) });
      }
      return state;
    },
  }),
  "reading.confirmCards": operation({
    input: z.object({
      batchId: idSchema,
      keepKeys: z.array(z.string().max(60)).max(200),
      scope: z.enum(["private", "catalog"]),
    }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const batch = await app.getCardBatch(user.id, input.batchId);
      const result = await app.confirmCardBatch({
        userId: user.id,
        pair: pairOf(user.preferences),
        ...input,
      });
      await app.markNotificationsRead(user.id, { href: routes.read(batch.episodeId, batch.batchId) });
      return result;
    },
  }),
  "reading.translateCue": operation({
    input: z.unknown(),
    run: async ({ user, app }, cueId) => {
      const parsed = idSchema.safeParse(cueId);
      if (!parsed.success) throw new AppError("CUE_NOT_FOUND");
      return app.translateCue({ userId: user.id, cueId: parsed.data, pair: pairOf(user.preferences) });
    },
  }),
};
