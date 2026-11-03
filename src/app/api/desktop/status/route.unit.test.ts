import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const media = (type: "series" | "movie") => ({ id: `m-${type}`, title: `Obra ${type}`, type });

const state = vi.hoisted(() => ({
  verified: true,
  inProgress: [] as unknown[],
  items: [] as unknown[],
}));

vi.mock("@/infrastructure/setup", () => ({ getDatabaseStatus: async () => ({ state: "ready" }) }));
vi.mock("@/infrastructure/desktop", () => ({ verifyDesktopRequest: () => state.verified }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock("@/infrastructure/container", () => ({
  getContainer: () => ({
    findOwner: async () => ({ id: "owner", name: "Ana" }),
    getCatalogOverview: async () => ({ entries: [], inProgress: state.inProgress }),
    getInbox: async () => ({ unread: state.items.length, items: state.items }),
    getPreferences: async () => ({ locale: "pt-BR", currentEpisodeId: null }),
  }),
}));

const { GET } = await import("./route");

const read = async () => {
  const response = await GET(new NextRequest("http://127.0.0.1:1300/api/desktop/status"));
  return { status: response.status, body: response.status === 200 ? await response.json() : null };
};

const progress = (type: "series" | "movie", seasonNumber: number) => ({
  episodeId: "e1",
  mediaId: `m-${type}`,
  media: media(type),
  label: "T1 · E1",
  seasonNumber,
  episodeNumber: 1,
  episodeTitle: "Piloto",
  progressPercent: 40,
});

describe("GET /api/desktop/status", () => {
  it("answers 404 to an unsigned request", async () => {
    state.verified = false;
    expect((await read()).status).toBe(404);
    state.verified = true;
  });

  it("points the resume item to the trail of the season in progress", async () => {
    state.inProgress = [progress("series", 2)];
    state.items = [];
    const { body } = await read();
    expect(body.current.href).toBe("/trail?id=m-series&season=2");
  });

  it("points a movie to its trail without season", async () => {
    state.inProgress = [progress("movie", 0)];
    const { body } = await read();
    expect(body.current.href).toBe("/trail?id=m-movie");
  });

  it("gives each notification its internal destination and drops unsafe ones", async () => {
    state.inProgress = [];
    state.items = [
      { id: "n1", kind: "cards_ready", params: {}, href: "/review", read: false, createdAt: new Date(0) },
      { id: "n2", kind: "trail_ready", params: {}, href: "//evil.example", read: false, createdAt: new Date(0) },
      { id: "n3", kind: "trail_ready", params: {}, href: "https://evil.example", read: false, createdAt: new Date(0) },
    ];
    const { body } = await read();
    expect(body.current).toBeNull();
    expect(body.notifications.map((item: { href: string }) => item.href)).toEqual(["/review", "/", "/"]);
  });
});
