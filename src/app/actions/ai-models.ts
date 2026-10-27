"use server";

import { runOperation } from "../operations";

export async function setAiModelsAction(input: unknown) {
  return runOperation("ai.setModels", input);
}

export async function assignAiModelAction(input: unknown) {
  return runOperation("ai.assignModel", input);
}

export async function updateAiDefaultsAction(input: unknown) {
  return runOperation("ai.updateDefaults", input);
}
