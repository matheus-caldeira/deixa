import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  ticketValid: true,
  signedIn: false,
  startSession: vi.fn(),
}));

vi.mock("@/infrastructure/setup", () => ({ getDatabaseStatus: async () => ({ state: "ready" }) }));
vi.mock("@/infrastructure/desktop", () => ({ redeemEntryTicket: () => state.ticketValid }));
vi.mock("@/infrastructure/container", () => ({
  getContainer: () => ({
    startOwnerSession: async () => ({ token: "token", expiresAt: new Date(0) }),
  }),
}));
vi.mock("../../session", () => ({
  getCurrentUser: async () => (state.signedIn ? { id: "owner" } : null),
  startSession: state.startSession,
}));

const { GET } = await import("./route");

const enter = (query: string) => GET(new NextRequest(`http://127.0.0.1:1300/desktop/enter?${query}`));

describe("GET /desktop/enter", () => {
  beforeEach(() => {
    state.ticketValid = true;
    state.signedIn = false;
    state.startSession.mockReset();
  });

  it("starts the owner session and goes to the requested study point", async () => {
    const response = await enter(`ticket=abc&next=${encodeURIComponent("/trail?id=m1&season=2")}`);
    expect(response.headers.get("location")).toBe("/trail?id=m1&season=2");
    expect(state.startSession).toHaveBeenCalledOnce();
  });

  it("goes home when the destination is missing or leaves the app", async () => {
    for (const next of ["", "//evil.example", "https://evil.example", "javascript:alert(1)"]) {
      const response = await enter(`ticket=abc&next=${encodeURIComponent(next)}`);
      expect(response.headers.get("location")).toBe("/");
    }
  });

  it("keeps the destination for someone already signed in", async () => {
    state.signedIn = true;
    const response = await enter(`ticket=abc&next=${encodeURIComponent("/read?id=e1")}`);
    expect(response.headers.get("location")).toBe("/read?id=e1");
    expect(state.startSession).not.toHaveBeenCalled();
  });

  it("sends an invalid ticket to the login", async () => {
    state.ticketValid = false;
    const response = await enter("ticket=abc&next=/review");
    expect(response.headers.get("location")).toBe("/login");
  });
});
