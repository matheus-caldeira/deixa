"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ImportReport } from "@/modules/packages";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

export async function importPackageAction(input: unknown): Promise<ActionResult<ImportReport>> {
  const user = await requireUser();
  return runAction("importPackage", async () => {
    const parsed = z
      .object({ uploadId: z.uuid(), password: z.string().min(1).max(200).optional() })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const report = await app().importPackage({
      userId: user.id,
      uploadId: parsed.data.uploadId,
      password: parsed.data.password,
    });
    revalidatePath("/catalog");
    revalidatePath("/");
    return report;
  });
}
