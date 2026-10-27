"use server";

import { runOperation } from "../operations";

export async function addLevelSourceAction(input: unknown) {
  return runOperation("levelSources.add", input);
}

export async function syncLevelSourcesAction() {
  return runOperation("levelSources.sync");
}

export async function setLevelSourceEnabledAction(input: unknown) {
  return runOperation("levelSources.setEnabled", input);
}

export async function removeLevelSourceAction(input: unknown) {
  return runOperation("levelSources.remove", input);
}
