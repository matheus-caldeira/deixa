"use server";

import { runOperation } from "../operations";

export async function setAiUsageLimitAction(input: unknown) {
  return runOperation("ai.setUsageLimit", input);
}

export async function updateSharedAiLimitAction(input: unknown) {
  return runOperation("ai.updateSharedLimit", input);
}

export async function saveModelPriceAction(input: unknown) {
  return runOperation("ai.saveModelPrice", input);
}
