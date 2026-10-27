"use server";

import { redirect } from "next/navigation";
import { runOperation } from "../operations";
import { routes } from "@/shared/routes";

export type { TurnView } from "@/operations/tutor";

export async function startConversationAction(input: unknown) {
  const result = await runOperation("tutor.start", input);
  if (result.ok) redirect(routes.conversation(result.data.sessionId));
  return result;
}

export async function startEpisodeConversationAction(episodeId: unknown) {
  const result = await runOperation("tutor.startEpisode", episodeId);
  if (result.ok) redirect(routes.conversation(result.data.sessionId));
  return result;
}

export async function sendMessageAction(input: unknown) {
  return runOperation("tutor.send", input);
}

export async function closeConversationAction(input: unknown) {
  return runOperation("tutor.close", input);
}

export async function requestConversationReviewAction(sessionId: unknown) {
  return runOperation("tutor.requestReview", sessionId);
}

export async function confirmConversationCardsAction(input: unknown) {
  return runOperation("tutor.confirmCards", input);
}

export async function requestTermCardsAction(input: unknown) {
  return runOperation("tutor.requestTermCards", input);
}
