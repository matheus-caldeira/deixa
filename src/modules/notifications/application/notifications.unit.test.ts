import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import {
  makeGetInbox,
  makeMarkNotificationsRead,
  makeNotify,
  type NewNotification,
  type NotificationRepository,
} from "./notifications";

function setup() {
  const rows: (NewNotification & { readAt: Date | null })[] = [];
  const mine = (userId: string) => rows.filter((row) => row.userId === userId);
  const notifications: NotificationRepository = {
    insert: async (notification) => {
      rows.push({ ...notification, readAt: null });
    },
    listRecent: async (userId, limit) =>
      mine(userId)
        .slice(-limit)
        .reverse()
        .map(({ userId: _userId, readAt, ...row }) => ({ ...row, read: readAt !== null })),
    countUnread: async (userId) => mine(userId).filter((row) => row.readAt === null).length,
    markRead: async (userId, id) => {
      for (const row of mine(userId)) if (row.id === id) row.readAt = new Date();
    },
    markAllRead: async (userId) => {
      for (const row of mine(userId)) row.readAt = new Date();
    },
    markReadByHref: async (userId, href) => {
      for (const row of mine(userId)) if (row.href === href) row.readAt = new Date();
    },
  };
  const deps = { notifications, clock: new FixedClock("2026-10-10T12:00:00Z"), ids: new SequentialIds("n") };
  return { notify: makeNotify(deps), inbox: makeGetInbox(deps), markRead: makeMarkNotificationsRead(deps) };
}

describe("notificações", () => {
  it("entrega só para o dono e conta as não lidas", async () => {
    const app = setup();
    await app.notify({
      userId: "ana",
      kind: "cards_ready",
      title: "Seus cards estão prontos",
      body: "4 cards",
      href: "/read/e1?batch=b1",
    });
    await app.notify({ userId: "ana", kind: "trail_ready", title: "Trilha pronta", body: "", href: "/" });
    await app.notify({
      userId: "lucas",
      kind: "cards_ready",
      title: "Seus cards estão prontos",
      body: "",
      href: "/read/e2?batch=b2",
    });

    const ana = await app.inbox("ana");
    expect(ana.unread).toBe(2);
    expect(ana.items.map((item) => item.title)).toEqual(["Trilha pronta", "Seus cards estão prontos"]);
    expect((await app.inbox("lucas")).unread).toBe(1);
  });

  it("marca como lida por id, por destino ou todas, sem tocar nas de outro usuário", async () => {
    const app = setup();
    await app.notify({ userId: "ana", kind: "cards_ready", title: "a", body: "", href: "/x" });
    await app.notify({ userId: "ana", kind: "cards_ready", title: "b", body: "", href: "/y" });
    await app.notify({ userId: "lucas", kind: "cards_ready", title: "c", body: "", href: "/x" });
    const first = (await app.inbox("ana")).items[0];

    await app.markRead("lucas", { id: first?.id ?? "" });
    expect((await app.inbox("ana")).unread).toBe(2);
    await app.markRead("ana", { href: "/x" });
    expect((await app.inbox("ana")).unread).toBe(1);
    expect((await app.inbox("lucas")).unread).toBe(1);
    await app.markRead("ana", "all");
    expect((await app.inbox("ana")).unread).toBe(0);
  });
});
