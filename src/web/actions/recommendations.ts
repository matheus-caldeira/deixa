import { callAction } from "../call";

export async function acceptRecommendationAction(workKey: unknown) {
  return callAction("recommendations.accept", workKey);
}

export async function dismissRecommendationAction(workKey: unknown) {
  return callAction("recommendations.dismiss", workKey);
}

export async function refreshRecommendationsAction() {
  return callAction("recommendations.refresh");
}
