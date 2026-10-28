import type { PlanStatus } from "@/modules/study";
import { isAppError } from "@/shared/errors";
import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import type { OperationContext } from "../operation";

export async function ensureCurrentPlan(
  { app, schedule }: OperationContext,
  input: { userId: string; episodeId: string; pair: LanguagePair; level: CefrLevel; episodeLabel: string },
): Promise<PlanStatus> {
  const result = await app.ensurePlan(input).catch((error: unknown): PlanStatus => {
    if (isAppError(error)) return { status: "FAILED", reason: error.code };
    throw error;
  });
  if (result.status === "PENDING" && result.job) await schedule("generate_plan", result.job);
  return result;
}
