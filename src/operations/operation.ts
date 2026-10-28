import type { z } from "zod";
import type { Container } from "@/infrastructure/container";
import type { SessionUser } from "@/modules/identity";
import type { JobKind, JobPayloads } from "@/modules/jobs";
import { AppError } from "@/shared/errors";
import type { StudyLanguage } from "@/shared/study-languages";

export type ScheduleJob = <K extends JobKind>(kind: K, payload: JobPayloads[K]) => Promise<{ jobId: string }>;

export type OperationContext = {
  user: SessionUser;
  app: Container;
  schedule: ScheduleJob;
  refreshSettings: () => Promise<void>;
  readSample: (language: StudyLanguage) => Promise<Upload | null>;
  translator: (namespace: string) => Promise<Translate>;
};

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export type Upload = { filename: string; bytes: Uint8Array };

export type Operation<Input, Output> = {
  input: z.ZodType<Input>;
  refresh: boolean;
  run: (context: OperationContext, input: Input) => Promise<Output>;
};

export function operation<Input, Output>(definition: {
  input: z.ZodType<Input>;
  refresh?: boolean;
  run: (context: OperationContext, input: Input) => Promise<Output>;
}): Operation<Input, Output> {
  return { refresh: false, ...definition };
}

export type AnyOperation = {
  input: z.ZodType;
  refresh: boolean;
  run: (context: OperationContext, input: never) => Promise<unknown>;
};

export async function execute(
  definition: AnyOperation,
  context: OperationContext,
  raw: unknown,
): Promise<unknown> {
  const parsed = definition.input.safeParse(raw);
  if (!parsed.success) throw new AppError("INVALID_INPUT");
  return definition.run(context, parsed.data as never);
}

export class ViewRedirect extends Error {
  constructor(readonly href: string) {
    super("view redirect");
    this.name = "ViewRedirect";
  }
}

export const REDIRECT_CODE = "REDIRECT";
