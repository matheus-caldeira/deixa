import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";

export type NotificationKind = "cards_ready" | "cards_failed" | "trail_ready" | "trail_failed";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: Date;
};

export type NewNotification = {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: Date;
};

export interface NotificationRepository {
  insert(notification: NewNotification): Promise<void>;
  listRecent(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  markReadByHref(userId: string, href: string): Promise<void>;
}

const INBOX_LIMIT = 30;
const MAX_TITLE = 120;
const MAX_BODY = 300;

type Deps = { notifications: NotificationRepository; clock: Clock; ids: IdGenerator };

export function makeNotify(deps: Deps) {
  return async function notify(input: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    href: string;
  }): Promise<void> {
    await deps.notifications.insert({
      id: deps.ids.next(),
      userId: input.userId,
      kind: input.kind,
      title: input.title.slice(0, MAX_TITLE),
      body: input.body.slice(0, MAX_BODY),
      href: input.href,
      createdAt: deps.clock.now(),
    });
  };
}

export function makeGetInbox(deps: Pick<Deps, "notifications">) {
  return async function getInbox(userId: string): Promise<{ unread: number; items: Notification[] }> {
    const [items, unread] = await Promise.all([
      deps.notifications.listRecent(userId, INBOX_LIMIT),
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
