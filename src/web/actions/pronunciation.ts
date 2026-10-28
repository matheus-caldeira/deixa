import { callAction } from "../call";

export async function checkPronunciationAction(input: unknown) {
  return callAction("pronunciation.check", input);
}
