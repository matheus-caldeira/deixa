"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { AppError } from "@/shared/errors";
import { scheduleJob } from "../schedule";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

export async function addLevelSourceAction(input: unknown): Promise<ActionResult<{ sourceId: string }>> {
  const user = await requireUser();
  return runAction("addLevelSource", async () => {
    const parsed = z.object({ url: z.string().max(4096) }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "levelSourceUrlInvalid");
    const result = await app().addLevelSource({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      url: parsed.data.url,
    });
    await scheduleJob(getContainer(), "level_sources_sync", { sourceId: result.sourceId }, user.id);
    revalidatePath("/settings");
    return result;
  });
}

export async function syncLevelSourcesAction(): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireUser();
  return runAction("syncLevelSources", async () => {
    await app().listLevelSources({ actor: { userId: user.id, isAdmin: user.isAdmin } });
    const result = await scheduleJob(getContainer(), "level_sources_sync", { sourceId: null }, user.id);
    revalidatePath("/settings");
    return result;
  });
}

export async function setLevelSourceEnabledAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("setLevelSourceEnabled", async () => {
    const parsed = z.object({ sourceId: z.uuid(), enabled: z.boolean() }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().setLevelSourceEnabled({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...parsed.data });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function removeLevelSourceAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("removeLevelSource", async () => {
    const parsed = z.object({ sourceId: z.uuid() }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().removeLevelSource({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...parsed.data });
    revalidatePath("/", "layout");
    return null;
  });
}
