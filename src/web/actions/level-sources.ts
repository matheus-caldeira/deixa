import { callAction } from "../call";

export async function addLevelSourceAction(input: unknown) {
  return callAction("levelSources.add", input);
}

export async function syncLevelSourcesAction() {
  return callAction("levelSources.sync");
}

export async function setLevelSourceEnabledAction(input: unknown) {
  return callAction("levelSources.setEnabled", input);
}

export async function removeLevelSourceAction(input: unknown) {
  return callAction("levelSources.remove", input);
}
