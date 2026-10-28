"use server";

import { runOperation } from "../operations";

export async function checkPronunciationAction(input: unknown) {
  return runOperation("pronunciation.check", input);
}
