import { isAppError, type AppError, type AppErrorCode } from "@/shared/errors";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getContainer } from "@/infrastructure/container";
import { logger } from "@/infrastructure/logger/logger";

export type ActionResult<Data> =
  { ok: true; data: Data } | { ok: false; message: string; code?: AppErrorCode };

export async function describeAppError(error: AppError): Promise<string> {
  const t = await getTranslations("errors");
  if (error.detail) {
    const key = `detail.${error.detail.key}`;
    if (t.has(key)) return t(key, error.detail.params);
  }
  return t.has(error.code) ? t(error.code) : t("generic");
}

export async function runAction<Data>(name: string, work: () => Promise<Data>): Promise<ActionResult<Data>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    if (isAppError(error)) {
      return { ok: false, code: error.code, message: await describeAppError(error) };
    }
    logger.error("action.failed", {
      action: name,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: (await getTranslations("errors"))("generic") };
  }
}

export const app = getContainer;
