import type { Clock } from "@/shared/clock";
import type { MessageParams } from "@/shared/errors";
import type { IdGenerator } from "@/shared/ids";

export const NOTIFICATION_KINDS = [
  "cards_ready",
  "cards_failed",
  "trail_ready",
  "trail_failed",
  "audio_ready",
  "conversation_review_ready",
  "conversation_review_failed",
  "conversation_terms_ready",
  "recommendations_ready",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type Notification = {
  id: string;
  kind: NotificationKind;
  params: MessageParams;
  href: string;
  read: boolean;
  createdAt: Date;
};

export type NewNotification = {
  id: string;
  userId: string;
  kind: NotificationKind;
  params: MessageParams;
  href: string;
  createdAt: Date;
};

export interface NotificationRepository {
  insert(notification: NewNotification): Promise<void>;
  listUnread(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  markReadByHref(userId: string, href: string): Promise<void>;
}

const INBOX_LIMIT = 30;

type Deps = { notifications: NotificationRepository; clock: Clock; ids: IdGenerator };

export function makeNotify(deps: Deps) {
  return async function notify(input: {
    userId: string;
    kind: NotificationKind;
    params: MessageParams;
    href: string;
  }): Promise<void> {
    await deps.notifications.insert({
      id: deps.ids.next(),
      userId: input.userId,
      kind: input.kind,
      params: input.params,
      href: input.href,
      createdAt: deps.clock.now(),
    });
  };
}

export function makeGetInbox(deps: Pick<Deps, "notifications">) {
  return async function getInbox(userId: string): Promise<{ unread: number; items: Notification[] }> {
    const [items, unread] = await Promise.all([
      deps.notifications.listUnread(userId, INBOX_LIMIT),
      deps.notifications.countUnread(userId),
    ]);
    return { unread, items };
  };
}

export function makeMarkNotificationsRead(deps: Pick<Deps, "notifications">) {
  return async function markNotificationsRead(
    userId: string,
    target: { id: string } | { href: string } | "all",
  ): Promise<void> {
    if (target === "all") await deps.notifications.markAllRead(userId);
    else if ("id" in target) await deps.notifications.markRead(userId, target.id);
    else await deps.notifications.markReadByHref(userId, target.href);
  };
}
