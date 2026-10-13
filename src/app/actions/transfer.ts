"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ImportReport } from "@/modules/packages";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const PERSONAL_THROTTLE_PREFIX = "personal:";

export async function importPackageAction(input: unknown): Promise<ActionResult<ImportReport>> {
  const user = await requireUser();
  return runAction("importPackage", async () => {
    const parsed = z
      .object({ uploadId: z.uuid(), password: z.string().min(1).max(200).optional() })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const throttle = app().loginThrottle;
    const originEmail = parsed.data.password
      ? await app().peekPersonalEmail({ userId: user.id, uploadId: parsed.data.uploadId })
      : null;
    const throttleKey = originEmail ? `${PERSONAL_THROTTLE_PREFIX}${originEmail}` : null;
    if (throttleKey && throttle.isBlocked(throttleKey)) {
      throw new AppError("INVALID_CREDENTIALS", "Muitas tentativas. Espere alguns minutos e tente de novo.");
    }
    if (throttleKey) throttle.recordFailure(throttleKey);
    const report = await app().importPackage({
      userId: user.id,
      uploadId: parsed.data.uploadId,
      password: parsed.data.password,
    });
    if (throttleKey) throttle.reset(throttleKey);
    revalidatePath("/catalog");
    revalidatePath("/");
    return report;
  });
}
