import { callAction } from "../call";

export async function renamePersonalSeriesAction(name: unknown) {
  return callAction("personalSeries.rename", name);
}

export async function setPersonalSeriesLevelAction(input: unknown) {
  return callAction("personalSeries.setLevel", input);
}

export async function completePersonalLessonAction(input: unknown) {
  return callAction("personalSeries.completeLesson", input);
}
