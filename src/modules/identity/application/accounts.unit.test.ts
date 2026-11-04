import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { InMemoryFileStorage } from "@/shared/storage";
import { SequentialIds } from "@/shared/ids";
import { makeCreateAccount } from "./create-account";
import { makeListAccounts } from "./list-accounts";
import { makeRemoveAccount } from "./remove-account";
import { makeResetAccountPassword } from "./reset-account-password";
import { makeSetAccountAdmin } from "./set-account-admin";
import { makeSignIn } from "./sign-in";
import { makeSignUp } from "./sign-up";
import type { SetupCodeGate } from "./ports";
import { InMemoryIdentityStore, plainPasswords, sequentialTokens } from "./testing/fakes";

const SETUP_CODE = "ABCD-EFGH-JKLM";

function fakeSetupCode(): SetupCodeGate & { consumed: boolean } {
  const gate = {
    consumed: false,
    matches: async (candidate: string) => !gate.consumed && candidate === SETUP_CODE,
    consume: async () => {
      gate.consumed = true;
    },
  };
  return gate;
}

function setup() {
  const store = new InMemoryIdentityStore();
  const clock = new FixedClock("2026-11-03T12:00:00Z");
  const files = new InMemoryFileStorage();
  const setupCode = fakeSetupCode();
  const base = {
    users: store,
    sessions: store,
    pairs: store,
    accounts: store,
    passwords: plainPasswords,
    tokens: sequentialTokens(),
    clock,
    ids: new SequentialIds("u"),
    accountFiles: { removeFor: (accountId: string) => files.removeDirectory(`packages/${accountId}`) },
  };
  return {
    store,
    files,
    clock,
    setupCode,
    signUp: makeSignUp({ ...base, firstAccount: "setup-code", setupCode }),
    signIn: makeSignIn(base),
    listAccounts: makeListAccounts(base),
    createAccount: makeCreateAccount(base),
    setAccountAdmin: makeSetAccountAdmin(base),
    resetAccountPassword: makeResetAccountPassword(base),
    removeAccount: makeRemoveAccount(base),
  };
}

const account = (name: string) => ({
  name,
  email: `${name.toLowerCase()}@example.com`,
  password: "segredo123",
  level: "A1" as const,
});

describe("gestão de contas", () => {
  let app: ReturnType<typeof setup>;
  let admin: { userId: string; isAdmin: boolean };

  beforeEach(async () => {
    app = setup();
    const { userId } = await app.signUp({ ...account("Dona"), proof: { cookieCode: SETUP_CODE } });
    admin = { userId, isAdmin: true };
  });

  it("primeira conta sem o código de configuração é recusada", async () => {
    const fresh = setup();
    await expect(fresh.signUp(account("Ana"))).rejects.toMatchObject({ code: "SETUP_CODE_INVALID" });
    await expect(fresh.signUp({ ...account("Ana"), proof: {} })).rejects.toMatchObject({
      code: "SETUP_CODE_INVALID",
    });
    await expect(
      fresh.signUp({ ...account("Ana"), proof: { cookieCode: "AAAA-BBBB-CCCC", typedCode: "  " } }),
    ).rejects.toMatchObject({ code: "SETUP_CODE_INVALID" });
    expect(fresh.store.users.size).toBe(0);
    expect(fresh.setupCode.consumed).toBe(false);
  });

  it("primeira conta com o código do cookie vira admin e gasta o código", async () => {
    const fresh = setup();
    await fresh.signUp({ ...account("Ana"), proof: { cookieCode: SETUP_CODE } });
    expect([...fresh.store.users.values()][0]?.isAdmin).toBe(true);
    expect(fresh.setupCode.consumed).toBe(true);
  });

  it("primeira conta com o código digitado no formulário vira admin, mesmo com cookie vencido", async () => {
    const fresh = setup();
    await fresh.signUp({
      ...account("Ana"),
      proof: { cookieCode: "AAAA-BBBB-CCCC", typedCode: SETUP_CODE },
    });
    expect([...fresh.store.users.values()][0]?.isAdmin).toBe(true);
    expect(fresh.setupCode.consumed).toBe(true);
  });

  it("com contas existentes, o cadastro não exige código e não vira admin", async () => {
    const { userId } = await app.signUp(account("Visita"));
    expect(app.store.users.get(userId)?.isAdmin).toBe(false);
  });

  it("política setup-code sem leitor de código recusa a primeira conta", async () => {
    const store = new InMemoryIdentityStore();
    const signUp = makeSignUp({
      users: store,
      pairs: store,
      passwords: plainPasswords,
      clock: new FixedClock("2026-11-03T12:00:00Z"),
      ids: new SequentialIds("p"),
      firstAccount: "setup-code",
    });
    await expect(signUp({ ...account("Ana"), proof: { typedCode: SETUP_CODE } })).rejects.toMatchObject({
      code: "SETUP_CODE_INVALID",
    });
  });

  it("política aberta (modo pessoal) aceita a primeira conta sem código", async () => {
    const store = new InMemoryIdentityStore();
    const signUp = makeSignUp({
      users: store,
      pairs: store,
      passwords: plainPasswords,
      clock: new FixedClock("2026-11-03T12:00:00Z"),
      ids: new SequentialIds("p"),
      firstAccount: "open",
    });
    await signUp(account("Ana"));
    expect(store.users.size).toBe(1);
  });

  it("quem não é admin não lista, não cria, não promove, não redefine nem remove", async () => {
    const { accountId } = await app.createAccount({ actor: admin, ...account("Lucas"), locale: "pt-BR" });
    const member = { userId: accountId, isAdmin: false };
    const denied = { code: "FORBIDDEN", detail: { key: "adminOnlyAccounts" } };
    await expect(app.listAccounts({ actor: member })).rejects.toMatchObject(denied);
    await expect(
      app.createAccount({ actor: member, ...account("Bia"), locale: "pt-BR" }),
    ).rejects.toMatchObject(denied);
    await expect(app.setAccountAdmin({ actor: member, accountId, isAdmin: true })).rejects.toMatchObject(
      denied,
    );
    await expect(
      app.resetAccountPassword({ actor: member, accountId: admin.userId, password: "outrasenha1" }),
    ).rejects.toMatchObject(denied);
    await expect(app.removeAccount({ actor: member, accountId: admin.userId })).rejects.toMatchObject(denied);
    expect(app.store.users.get(accountId)?.isAdmin).toBe(false);
  });

  it("lista as contas com criação e último acesso", async () => {
    await app.createAccount({ actor: admin, ...account("Lucas"), locale: "pt-BR" });
    app.clock.advanceDays(1);
    await app.signIn({ email: "dona@example.com", password: "segredo123" });
    const accounts = await app.listAccounts({ actor: admin });
    expect(accounts.map((entry) => [entry.name, entry.isAdmin])).toEqual([
      ["Dona", true],
      ["Lucas", false],
    ]);
    expect(accounts[0]?.lastActiveAt?.toISOString()).toBe("2026-11-04T12:00:00.000Z");
    expect(accounts[1]?.lastActiveAt).toBeNull();
    expect(accounts[1]?.createdAt.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(accounts[0]).not.toHaveProperty("passwordHash");
  });

  it("admin cria conta que entra com a senha inicial e recusa e-mail repetido", async () => {
    await app.createAccount({ actor: admin, ...account("Lucas"), locale: "en" });
    await expect(app.signIn({ email: "lucas@example.com", password: "segredo123" })).resolves.toBeTruthy();
    await expect(
      app.createAccount({ actor: admin, ...account("Lucas"), locale: "en" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("promove e retira admin, mas nunca deixa a instalação sem admin", async () => {
    const { accountId } = await app.createAccount({ actor: admin, ...account("Lucas"), locale: "pt-BR" });
    await expect(
      app.setAccountAdmin({ actor: admin, accountId: admin.userId, isAdmin: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", detail: { key: "lastAdmin" } });
    await app.setAccountAdmin({ actor: admin, accountId, isAdmin: true });
    expect(app.store.users.get(accountId)?.isAdmin).toBe(true);
    await app.setAccountAdmin({ actor: admin, accountId: admin.userId, isAdmin: false });
    expect(app.store.users.get(admin.userId)?.isAdmin).toBe(false);
    await expect(
      app.setAccountAdmin({ actor: { userId: accountId, isAdmin: true }, accountId, isAdmin: false }),
    ).rejects.toMatchObject({ detail: { key: "lastAdmin" } });
    await expect(
      app.setAccountAdmin({ actor: admin, accountId: "u-999", isAdmin: true }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("redefine a senha e encerra todas as sessões da conta", async () => {
    const { accountId } = await app.createAccount({ actor: admin, ...account("Lucas"), locale: "pt-BR" });
    await app.signIn({ email: "lucas@example.com", password: "segredo123" });
    await app.signIn({ email: "lucas@example.com", password: "segredo123" });
    await app.signIn({ email: "dona@example.com", password: "segredo123" });
    await app.resetAccountPassword({ actor: admin, accountId, password: "senhanova123" });
    const sessionsOf = (userId: string) =>
      [...app.store.sessions.values()].filter((session) => session.userId === userId).length;
    expect(sessionsOf(accountId)).toBe(0);
    expect(sessionsOf(admin.userId)).toBe(1);
    await expect(app.signIn({ email: "lucas@example.com", password: "segredo123" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(app.signIn({ email: "lucas@example.com", password: "senhanova123" })).resolves.toBeTruthy();
    await expect(
      app.resetAccountPassword({ actor: admin, accountId, password: "curta" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.resetAccountPassword({ actor: admin, accountId: "u-999", password: "senhanova123" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("remove outra conta, mas nunca a própria nem o último admin", async () => {
    const { accountId } = await app.createAccount({ actor: admin, ...account("Lucas"), locale: "pt-BR" });
    await expect(app.removeAccount({ actor: admin, accountId: admin.userId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      detail: { key: "cannotRemoveSelf" },
    });
    await app.setAccountAdmin({ actor: admin, accountId, isAdmin: true });
    await app.setAccountAdmin({ actor: admin, accountId: admin.userId, isAdmin: false });
    await expect(
      app.removeAccount({ actor: { userId: "u-outro", isAdmin: true }, accountId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", detail: { key: "lastAdmin" } });
    const bytes = new Uint8Array([1]);
    await app.files.write(`packages/${admin.userId}/envio.zip`, bytes);
    await app.files.write(`packages/${accountId}/envio.zip`, bytes);
    await app.removeAccount({ actor: { userId: accountId, isAdmin: true }, accountId: admin.userId });
    expect(app.store.users.has(admin.userId)).toBe(false);
    expect(await app.files.exists(`packages/${admin.userId}/envio.zip`)).toBe(false);
    expect(await app.files.exists(`packages/${accountId}/envio.zip`)).toBe(true);
    expect(app.store.preferencesByUser.has(admin.userId)).toBe(false);
    await expect(
      app.removeAccount({ actor: { userId: accountId, isAdmin: true }, accountId: admin.userId }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });
});
