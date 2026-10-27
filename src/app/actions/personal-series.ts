"use server";

import { runOperation } from "../operations";

export async function renamePersonalSeriesAction(name: unknown) {
  return runOperation("personalSeries.rename", name);
}

export async function setPersonalSeriesLevelAction(input: unknown) {
  return runOperation("personalSeries.setLevel", input);
}

export async function completePersonalLessonAction(input: unknown) {
  return runOperation("personalSeries.completeLesson", input);
}
