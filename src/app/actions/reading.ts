"use server";

import { runOperation } from "../operations";

export type { SavedHighlightView } from "@/operations/reading";

export async function syncHighlightsAction(input: unknown) {
  return runOperation("reading.syncHighlights", input);
}

export async function startCardGenerationAction(input: unknown) {
  return runOperation("reading.startCardGeneration", input);
}

export async function getCardBatchAction(batchId: unknown) {
  return runOperation("reading.cardBatch", batchId);
}

export async function confirmCardsAction(input: unknown) {
  return runOperation("reading.confirmCards", input);
}

export async function translateCueAction(cueId: unknown) {
  return runOperation("reading.translateCue", cueId);
}
