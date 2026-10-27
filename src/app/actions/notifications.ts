"use server";

import { runOperation } from "../operations";

export type { InboxView } from "@/operations/notifications";

export async function getInboxAction() {
  return runOperation("notifications.inbox");
}

export async function markNotificationReadAction(target: unknown) {
  return runOperation("notifications.markRead", target);
}
