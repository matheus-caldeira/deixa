import { callAction } from "../call";

export async function gradeCardAction(input: unknown) {
  return callAction("review.gradeCard", input);
}

export async function anticipateReviewAction() {
  return callAction("review.anticipate");
}
