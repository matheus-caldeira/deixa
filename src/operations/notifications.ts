import { z } from "zod";
import type { MessageParams } from "@/shared/errors";
import { operation } from "./operation";

export type InboxView = {
  unread: number;
  items: {
    id: string;
    kind: string;
    params: MessageParams;
    href: string;
    read: boolean;
    createdAt: string;
  }[];
};

export const notificationOperations = {
  "notifications.inbox": operation({
    input: z.undefined(),
    run: async ({ user, app }): Promise<InboxView> => {
      const inbox = await app.getInbox(user.id);
      return {
        unread: inbox.unread,
        items: inbox.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      };
    },
  }),
  "notifications.markRead": operation({
    input: z.unknown(),
    run: async ({ user, app }, target) => {
      const parsed = z.union([z.literal("all"), z.uuid()]).safeParse(target);
      if (!parsed.success) return null;
      await app.markNotificationsRead(user.id, parsed.data === "all" ? "all" : { id: parsed.data });
      return null;
    },
  }),
};
