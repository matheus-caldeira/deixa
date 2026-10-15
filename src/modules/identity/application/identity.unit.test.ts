import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { makeGetSessionUser, makeSignOut } from "./session-user";
import { SESSION_TTL_DAYS, makeSignIn } from "./sign-in";
import { makeSignUp } from "./sign-up";
import { makeUpdatePreferences } from "./update-preferences";
import { InMemoryIdentityStore, passwordChecks, plainPasswords, sequentialTokens } from "./testing/fakes";

function setup() {
  const store = new InMemoryIdentityStore();
  const clock = new FixedClock("2026-10-10T12:00:00Z");
  const ids = new SequentialIds("u");
  const tokens = sequentialTokens();
  const base = {
    users: store,
    sessions: store,
    preferences: store,
    pairs: store,
    passwords: plainPasswords,
    tokens,
    clock,
    ids,
  };
  return {
    store,
    clock,
    signUp: makeSignUp(base),
    signIn: makeSignIn(base),
    signOut: makeSignOut(base),
    getSessionUser: makeGetSessionUser(base),
    updatePreferences: makeUpdatePreferences(base),
  };
}

describe("identidade", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("cria conta com preferências padrão do nível escolhido e e-mail normalizado", async () => {
    const { userId } = await app.signUp({
      name: " Ana ",
      email: "Ana@Example.com",
      password: "segredo123",
      level: "A1",
    });
    const session = await app.signIn({ email: "ana@example.com", password: "segredo123" });
    const user = await app.getSessionUser(session.token);
    expect(user).toMatchObject({ id: userId, name: "Ana", email: "ana@example.com" });
    expect(user?.preferences).toMatchObject({
      level: "A1",
      dailyGoal: 100,
      preferredAccent: "US",
      audioSpeed: 1,
    });
  });

  it("recusa e-mail repetido, senha curta e dados em branco", async () => {
    await app.signUp({ name: "Ana", email: "ana@example.com", password: "segredo123", level: "A1" });
    await expect(
      app.signUp({ name: "Outra", email: "ANA@example.com", password: "segredo123", level: "B1" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    await expect(
      app.signUp({ name: "Bia", email: "bia@example.com", password: "curta", level: "B1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.signUp({ name: " ", email: "x@example.com", password: "segredo123", level: "B1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("devolve o mesmo erro para e-mail inexistente e senha errada", async () => {
    await app.signUp({ name: "Ana", email: "ana@example.com", password: "segredo123", level: "A1" });
    await expect(app.signIn({ email: "ana@example.com", password: "errada" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(app.signIn({ email: "ninguem@example.com", password: "segredo123" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("confere a senha mesmo quando o e-mail não existe, para não revelar quais contas existem", async () => {
    passwordChecks.length = 0;
    await expect(app.signIn({ email: "ninguem@example.com", password: "qualquer" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(passwordChecks).toEqual([{ plain: "qualquer", hadStoredHash: false }]);
  });

  it("expira a sessão depois do prazo e a invalida ao sair", async () => {
    await app.signUp({ name: "Ana", email: "ana@example.com", password: "segredo123", level: "A1" });
    const first = await app.signIn({ email: "ana@example.com", password: "segredo123" });
    await app.signOut(first.token);
    expect(await app.getSessionUser(first.token)).toBeNull();

    const second = await app.signIn({ email: "ana@example.com", password: "segredo123" });
    app.clock.advanceDays(SESSION_TTL_DAYS + 1);
    expect(await app.getSessionUser(second.token)).toBeNull();
    expect(await app.getSessionUser(undefined)).toBeNull();
  });

  it("guarda só o hash do token de sessão", async () => {
    await app.signUp({ name: "Ana", email: "ana@example.com", password: "segredo123", level: "A1" });
    const session = await app.signIn({ email: "ana@example.com", password: "segredo123" });
    expect([...app.store.sessions.keys()]).not.toContain(session.token);
  });

  it("atualiza preferências de um usuário sem tocar nas de outro", async () => {
    const ana = await app.signUp({
      name: "Ana",
      email: "ana@example.com",
      password: "segredo123",
      level: "A1",
    });
    const lucas = await app.signUp({
      name: "Lucas",
      email: "lucas@example.com",
      password: "segredo123",
      level: "C1",
    });
    await app.updatePreferences(ana.userId, { dailyGoal: 50, preferredAccent: "UK", audioSpeed: 0.8 });
    expect(app.store.preferencesByUser.get(ana.userId)).toMatchObject({
      dailyGoal: 50,
      preferredAccent: "UK",
      audioSpeed: 0.8,
    });
    expect(app.store.preferencesByUser.get(lucas.userId)).toMatchObject({
      dailyGoal: 100,
      preferredAccent: "US",
      audioSpeed: 1,
    });
    await expect(app.updatePreferences(ana.userId, { dailyGoal: 77 })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
