import { routes } from "@/shared/routes";
import { callAction } from "../call";
import { navigate } from "../navigation";

export type { TurnView } from "@/operations/tutor";

export async function startConversationAction(input: unknown) {
  const result = await callAction("tutor.start", input);
  if (result.ok) navigate(routes.conversation(result.data.sessionId));
  return result;
}

export async function startEpisodeConversationAction(episodeId: unknown) {
  const result = await callAction("tutor.startEpisode", episodeId);
  if (result.ok) navigate(routes.conversation(result.data.sessionId));
  return result;
}

export async function sendMessageAction(input: unknown) {
  return callAction("tutor.send", input);
}

export async function closeConversationAction(input: unknown) {
  return callAction("tutor.close", input);
}

export async function requestConversationReviewAction(sessionId: unknown) {
  return callAction("tutor.requestReview", sessionId);
}

export async function confirmConversationCardsAction(input: unknown) {
  return callAction("tutor.confirmCards", input);
}

export async function requestTermCardsAction(input: unknown) {
  return callAction("tutor.requestTermCards", input);
}
