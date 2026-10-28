import { callAction } from "../call";

export async function setAiModelsAction(input: unknown) {
  return callAction("ai.setModels", input);
}

export async function assignAiModelAction(input: unknown) {
  return callAction("ai.assignModel", input);
}

export async function updateAiDefaultsAction(input: unknown) {
  return callAction("ai.updateDefaults", input);
}
