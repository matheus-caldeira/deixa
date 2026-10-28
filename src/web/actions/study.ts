import { callAction } from "../call";

export async function completeLessonAction(input: unknown) {
  return callAction("study.completeLesson", input);
}

export async function retryTrailAction(episodeId: unknown) {
  return callAction("study.retryTrail", episodeId);
}

export async function completeRecapAction(input: unknown) {
  return callAction("study.completeRecap", input);
}
