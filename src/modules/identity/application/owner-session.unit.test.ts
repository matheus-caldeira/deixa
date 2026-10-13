import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { MS_PER_DAY } from "@/shared/time";
import { makeFindOwner, makeStartOwnerSession } from "./owner-session";
import { makeGetSessionUser } from "./session-user";
import { SESSION_TTL_DAYS } from "./sign-in";
import { makeSignUp } from "./sign-up";
import { InMemoryIdentityStore, plainPasswords, sequentialTokens } from "./testing/fakes";

function setup() {
  const store = new InMemoryIdentityStore();
  const clock = new FixedClock("2026-10-12T12:00:00Z");
  const base = {
    users: store,
    sessions: store,
    preferences: store,
    passwords: plainPasswords,
    tokens: sequentialTokens(),
    clock,
    ids: new SequentialIds("u"),
  };
  return {
    clock,
    signUp: makeSignUp(base),
    findOwner: makeFindOwner(base),
    startOwnerSession: makeStartOwnerSession(base),
    getSessionUser: makeGetSessionUser(base),
  };
}

describe("sessão do dono do computador", () => {
  it("sem nenhuma conta não há dono nem sessão", async () => {
    const app = setup();
    expect(await app.findOwner()).toBeNull();
    expect(await app.startOwnerSession()).toBeNull();
  });

  it("abre a sessão da conta administradora, e não a de outra conta", async () => {
    const app = setup();
    const owner = await app.signUp({
      name: "Dona",
      email: "dona@example.com",
      password: "segredo123",
      level: "B1",
    });
    await app.signUp({ name: "Visita", email: "visita@example.com", password: "segredo123", level: "A1" });
    expect(await app.findOwner()).toMatchObject({ id: owner.userId, name: "Dona", isAdmin: true });

    const session = await app.startOwnerSession();
    expect(session?.userId).toBe(owner.userId);
    expect(session?.expiresAt.getTime()).toBe(app.clock.now().getTime() + SESSION_TTL_DAYS * MS_PER_DAY);
    expect(await app.getSessionUser(session?.token)).toMatchObject({ name: "Dona", isAdmin: true });
  });

  it("cada entrada gera uma sessão própria, que expira como as demais", async () => {
    const app = setup();
    await app.signUp({ name: "Dona", email: "dona@example.com", password: "segredo123", level: "B1" });
    const first = await app.startOwnerSession();
    const second = await app.startOwnerSession();
    expect(first?.token).not.toBe(second?.token);
    app.clock.advanceDays(SESSION_TTL_DAYS + 1);
    expect(await app.getSessionUser(first?.token)).toBeNull();
  });
});
