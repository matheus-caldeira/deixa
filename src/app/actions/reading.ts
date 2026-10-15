"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { episodeLabel } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import type { LanguagePair } from "@/shared/study-languages";
import type { CardBatchState, ConfirmedBatch } from "@/modules/learning";
import { AppError } from "@/shared/errors";
import { scheduleJob } from "../schedule";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

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

export type SavedHighlightView = {
  cueId: string;
  startToken: number;
  endToken: number;
  kind: "word" | "phrase" | "line";
  carded: boolean;
};

async function sync(
  userId: string,
  pair: LanguagePair,
  input: unknown,
): Promise<{ episodeId: string; highlights: SavedHighlightView[] }> {
  const parsed = z.object({ episodeId: idSchema, marks: marksSchema }).safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT");
  const highlights = await app().syncHighlights({ userId, pair, ...parsed.data });
  return {
    episodeId: parsed.data.episodeId,
    highlights: highlights.map((highlight) => ({
      cueId: highlight.cueId,
      startToken: highlight.startToken,
      endToken: highlight.endToken,
      kind: highlight.kind,
      carded: highlight.cardBatchId !== null,
    })),
  };
}

export async function syncHighlightsAction(input: unknown): Promise<ActionResult<SavedHighlightView[]>> {
  const user = await requireUser();
  return runAction(
    "syncHighlights",
    async () => (await sync(user.id, pairOf(user.preferences), input)).highlights,
  );
}

export async function startCardGenerationAction(input: unknown): Promise<ActionResult<{ batchId: string }>> {
  const user = await requireUser();
  return runAction("startCardGeneration", async () => {
    const { episodeId } = await sync(user.id, pairOf(user.preferences), input);
    const context = await app().getEpisodeContext(episodeId);
    if (!context) throw new AppError("EPISODE_NOT_FOUND");
    const { batchId } = await app().requestCardDrafts({ userId: user.id, episodeId });
    const job = {
      userId: user.id,
      episodeId,
      batchId,
      learnerLevel: user.preferences.level,
      pair: pairOf(user.preferences),
      episodeLabel: `${context.media.title} · ${episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)}`,
    };
    await scheduleJob(app(), "card_batch", job, user.id);
    return { batchId };
  });
}

export async function getCardBatchAction(batchId: unknown): Promise<ActionResult<CardBatchState>> {
  const user = await requireUser();
  return runAction("getCardBatch", async () => {
    const parsed = idSchema.safeParse(batchId);
    if (!parsed.success) throw new AppError("BATCH_NOT_FOUND");
    const state = await app().getCardBatch(user.id, parsed.data);
    if (state.status === "DRAFT" || state.status === "SAVED") {
      await app().markNotificationsRead(user.id, { href: `/read/${state.episodeId}?batch=${state.batchId}` });
    }
    return state;
  });
}

export async function confirmCardsAction(input: unknown): Promise<ActionResult<ConfirmedBatch>> {
  const user = await requireUser();
  return runAction("confirmCards", async () => {
    const parsed = z
      .object({
        batchId: idSchema,
        keepKeys: z.array(z.string().max(60)).max(200),
        scope: z.enum(["private", "catalog"]),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const batch = await app().getCardBatch(user.id, parsed.data.batchId);
    const result = await app().confirmCardBatch({
      userId: user.id,
      pair: pairOf(user.preferences),
      ...parsed.data,
    });
    await app().markNotificationsRead(user.id, { href: `/read/${batch.episodeId}?batch=${batch.batchId}` });
    revalidatePath("/review");
    revalidatePath("/");
    return result;
  });
}

export async function translateCueAction(
  cueId: unknown,
): Promise<ActionResult<{ text: string; source: "subtitle_pt" | "llm" }>> {
  const user = await requireUser();
  return runAction("translateCue", async () => {
    const parsed = idSchema.safeParse(cueId);
    if (!parsed.success) throw new AppError("CUE_NOT_FOUND");
    return app().translateCue({ userId: user.id, cueId: parsed.data, pair: pairOf(user.preferences) });
  });
}
