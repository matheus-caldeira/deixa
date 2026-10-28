import { callAction } from "../call";

export type { SavedHighlightView } from "@/operations/reading";

export async function syncHighlightsAction(input: unknown) {
  return callAction("reading.syncHighlights", input);
}

export async function startCardGenerationAction(input: unknown) {
  return callAction("reading.startCardGeneration", input);
}

export async function getCardBatchAction(batchId: unknown) {
  return callAction("reading.cardBatch", batchId);
}

export async function confirmCardsAction(input: unknown) {
  return callAction("reading.confirmCards", input);
}

export async function translateCueAction(cueId: unknown) {
  return callAction("reading.translateCue", cueId);
}
