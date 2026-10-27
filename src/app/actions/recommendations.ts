"use server";

import { runOperation } from "../operations";

export async function acceptRecommendationAction(workKey: unknown) {
  return runOperation("recommendations.accept", workKey);
}

export async function dismissRecommendationAction(workKey: unknown) {
  return runOperation("recommendations.dismiss", workKey);
}

export async function refreshRecommendationsAction() {
  return runOperation("recommendations.refresh");
}
