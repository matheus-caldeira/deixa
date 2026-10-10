"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CardDraft, ConfirmedBatch } from "@/modules/learning";
import { AppError } from "@/shared/errors";
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

export type GeneratedCardsView = {
  batchId: string;
  drafts: CardDraft[];
  steps: { label: string; detail: string }[];
  translationsFromSubtitle: number;
  simulated: boolean;
};

async function sync(
  userId: string,
  input: unknown,
): Promise<{ episodeId: string; highlights: SavedHighlightView[] }> {
  const parsed = z.object({ episodeId: idSchema, marks: marksSchema }).safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT");
  const highlights = await app().syncHighlights({ userId, ...parsed.data });
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
  return runAction("syncHighlights", async () => (await sync(user.id, input)).highlights);
}

export async function generateCardsAction(input: unknown): Promise<ActionResult<GeneratedCardsView>> {
  const user = await requireUser();
  return runAction("generateCards", async () => {
    const { episodeId } = await sync(user.id, input);
    const generated = await app().generateCardDrafts({
      userId: user.id,
      episodeId,
      learnerLevel: user.preferences.level,
    });
    return {
      batchId: generated.batchId,
      drafts: generated.drafts,
      steps: generated.steps,
      translationsFromSubtitle: generated.translationsFromSubtitle,
      simulated: generated.llmProvider === "fake",
    };
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
    const result = await app().confirmCardBatch({ userId: user.id, ...parsed.data });
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
    return app().translateCue({ userId: user.id, cueId: parsed.data });
  });
}
