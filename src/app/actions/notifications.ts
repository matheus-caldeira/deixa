"use server";

import { z } from "zod";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

export type InboxView = {
  unread: number;
  items: {
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string;
    read: boolean;
    createdAt: string;
  }[];
};

export async function getInboxAction(): Promise<ActionResult<InboxView>> {
  const user = await requireUser();
  return runAction("getInbox", async () => {
    const inbox = await app().getInbox(user.id);
    return {
      unread: inbox.unread,
      items: inbox.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  });
}

export async function markNotificationReadAction(target: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("markNotificationRead", async () => {
    const parsed = z.union([z.literal("all"), z.uuid()]).safeParse(target);
    if (!parsed.success) return null;
    await app().markNotificationsRead(user.id, parsed.data === "all" ? "all" : { id: parsed.data });
    return null;
  });
}
