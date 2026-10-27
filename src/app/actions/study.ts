"use server";

import { runOperation } from "../operations";

export async function completeLessonAction(input: unknown) {
  return runOperation("study.completeLesson", input);
}

export async function retryTrailAction(episodeId: unknown) {
  return runOperation("study.retryTrail", episodeId);
}

export async function completeRecapAction(input: unknown) {
  return runOperation("study.completeRecap", input);
}
