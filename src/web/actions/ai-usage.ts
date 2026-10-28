import { callAction } from "../call";

export async function setAiUsageLimitAction(input: unknown) {
  return callAction("ai.setUsageLimit", input);
}

export async function updateSharedAiLimitAction(input: unknown) {
  return callAction("ai.updateSharedLimit", input);
}

export async function saveModelPriceAction(input: unknown) {
  return callAction("ai.saveModelPrice", input);
}
