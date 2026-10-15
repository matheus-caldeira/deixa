import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import { notifications } from "@/infrastructure/database/schema";
import type { MessageParams } from "@/shared/errors";
import {
  NOTIFICATION_KINDS,
  type NewNotification,
  type Notification,
  type NotificationRepository,
} from "../application/notifications";

const KINDS = NOTIFICATION_KINDS;
const paramsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

function readParams(value: unknown): MessageParams {
  const parsed = paramsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async insert(notification: NewNotification): Promise<void> {
    await this.db.insert(notifications).values(notification);
  }

  async listUnread(userId: string, limit: number): Promise<Notification[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      kind: KINDS.find((kind) => kind === row.kind) ?? "cards_ready",
      params: readParams(row.params),
      href: row.href,
      read: row.readAt !== null,
      createdAt: row.createdAt,
    }));
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.total ?? 0;
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    if (!z.uuid().safeParse(notificationId).success) return;
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId)));
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  async markReadByHref(userId: string, href: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.href, href), isNull(notifications.readAt)),
      );
  }
}
