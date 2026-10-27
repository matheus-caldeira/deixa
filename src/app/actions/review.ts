"use server";

import { runOperation } from "../operations";

export async function gradeCardAction(input: unknown) {
  return runOperation("review.gradeCard", input);
}

export async function anticipateReviewAction() {
  return runOperation("review.anticipate");
}
