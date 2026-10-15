import { after } from "next/server";
import type { Container } from "@/infrastructure/container";
import type { JobKind, JobPayloads } from "@/modules/jobs";

export async function scheduleJob<K extends JobKind>(
  container: Container,
  kind: K,
  payload: JobPayloads[K],
  createdBy?: string,
): Promise<{ jobId: string }> {
  const { jobId } = await container.enqueueJob({ kind, payload, createdBy });
  if (container.jobsMode === "inline") {
    after(() => container.runJobInline(jobId).catch(() => undefined));
  }
  return { jobId };
}
