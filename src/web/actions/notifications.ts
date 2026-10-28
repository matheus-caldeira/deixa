import { callAction } from "../call";

export type { InboxView } from "@/operations/notifications";

export async function getInboxAction() {
  return callAction("notifications.inbox");
}

export async function markNotificationReadAction(target: unknown) {
  return callAction("notifications.markRead", target);
}
