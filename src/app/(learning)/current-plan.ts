import type { Container } from "@/infrastructure/container";
import type { PlanStatus } from "@/modules/study";
import { isAppError } from "@/shared/errors";
import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import { scheduleJob } from "../schedule";

export async function ensureCurrentPlan(
  container: Container,
  input: { userId: string; episodeId: string; pair: LanguagePair; level: CefrLevel; episodeLabel: string },
): Promise<PlanStatus> {
  const result = await container.ensurePlan(input).catch((error: unknown): PlanStatus => {
    if (isAppError(error)) return { status: "FAILED", reason: error.code };
    throw error;
  });
  if (result.status === "PENDING" && result.job) {
    await scheduleJob(container, "generate_plan", result.job, input.userId);
  }
  return result;
}
