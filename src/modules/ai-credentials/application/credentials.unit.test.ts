import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { looksLikeGoogleApiKey, maskApiKey } from "../domain/api-key";
import { looksLikeSecret, tmdbSecretKind, type CredentialService } from "../domain/services";
import { AesGcmCipher } from "../infrastructure/aes-gcm-cipher";
import {
  makeGetCredentialOverview,
  makeRemoveCredential,
  makeResolveCredential,
  makeSaveCredential,
  unreadableCredentials,
} from "./credential-use-cases";
import { InMemoryCredentials } from "./testing/fakes";

const MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
const sampleKey = (suffix: string) => `AIza${"x".repeat(31)}${suffix}`;
const TMDB_KEY = "0123456789abcdef0123456789abcdef";
const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaWN0aWNpbyJ9.assinaturaFicticia";
const SUBTITLES_KEY = "AbCdEfGhIjKlMnOpQrStUvWx";
const ana = { userId: "ana", isAdmin: false };
const dono = { userId: "dono", isAdmin: true };

function setup(options: { accepts?: boolean; masterKey?: string; environment?: CredentialService[] } = {}) {
  const credentials = new InMemoryCredentials();
  const tested: string[] = [];
  const deps = {
    credentials,
    cipher: new AesGcmCipher(options.masterKey ?? MASTER_KEY),
    clock: new FixedClock("2026-10-10T12:00:00Z"),
    environmentServices: new Set<CredentialService>(options.environment ?? []),
    testCredential: async (service: CredentialService, secret: string) => {
      tested.push(`${service}:${secret}`);
      return options.accepts ?? true;
    },
  };
  return {
    credentials,
    tested,
    deps,
    save: makeSaveCredential(deps),
    overview: makeGetCredentialOverview(deps),
    remove: makeRemoveCredential(deps),
    resolve: makeResolveCredential(deps),
  };
}

describe("cifra AES-256-GCM", () => {
  const cipher = new AesGcmCipher(MASTER_KEY);

  it("cifra e decifra de volta, com resultado diferente a cada vez", () => {
    const first = cipher.encrypt(sampleKey("a91F"));
    const second = cipher.encrypt(sampleKey("a91F"));
    expect(first).not.toBe(second);
    expect(first).not.toContain("AIza");
    expect(cipher.decrypt(first)).toBe(sampleKey("a91F"));
  });

  it("falha quando o texto cifrado é adulterado ou a chave mestra é outra", () => {
    const encrypted = cipher.encrypt(sampleKey("a91F"));
    const [version, iv, tag, data] = encrypted.split(".");
    const tampered = [version, iv, tag, Buffer.from("outra coisa").toString("base64")].join(".");
    expect(() => cipher.decrypt(tampered)).toThrow();
    expect(() => cipher.decrypt(`${version}.${iv}.${data}`)).toThrow(/formato/);
    const otherCipher = new AesGcmCipher(Buffer.alloc(32, 3).toString("base64"));
    expect(() => otherCipher.decrypt(encrypted)).toThrow();
    expect(() => new AesGcmCipher("curta")).toThrow(/32 bytes/);
  });
});

describe("formato das chaves por serviço", () => {
  it("reconhece chave do Gemini, token ou chave do TMDB e chave do OpenSubtitles", () => {
    expect(looksLikeGoogleApiKey(sampleKey("a91F"))).toBe(true);
    expect(looksLikeSecret("gemini", "sk-qualquer-coisa")).toBe(false);
    expect(tmdbSecretKind(TMDB_KEY)).toBe("apiKey");
    expect(tmdbSecretKind(TMDB_TOKEN)).toBe("readAccessToken");
    expect(looksLikeSecret("tmdb", "curta")).toBe(false);
    expect(looksLikeSecret("opensubtitles", SUBTITLES_KEY)).toBe(true);
    expect(looksLikeSecret("opensubtitles", "com espaço e símbolos!")).toBe(false);
    expect(maskApiKey("abcdefgh")).toBe("••••••••");
  });
});

describe("chaves por usuário e chave global", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("valida o formato antes de testar e não salva a chave que o serviço recusa", async () => {
    await expect(
      app.save({ actor: ana, service: "gemini", scope: "user", secret: "chave-errada" }),
    ).rejects.toMatchObject({ code: "AI_KEY_INVALID" });
    expect(app.tested).toEqual([]);
    const rejecting = setup({ accepts: false });
    await expect(
      rejecting.save({ actor: ana, service: "tmdb", scope: "user", secret: TMDB_KEY }),
    ).rejects.toMatchObject({ code: "AI_KEY_REJECTED" });
    expect(rejecting.credentials.byUser.size).toBe(0);
  });

  it("testa, cifra e devolve só a versão mascarada, uma chave por serviço", async () => {
    const state = await app.save({
      actor: ana,
      service: "gemini",
      scope: "user",
      secret: `  ${sampleKey("a91F")}  `,
    });
    expect(state).toEqual({ state: "ready", masked: "AIza••••••••a91F" });
    await app.save({ actor: ana, service: "opensubtitles", scope: "user", secret: SUBTITLES_KEY });
    expect(app.tested).toEqual([`gemini:${sampleKey("a91F")}`, `opensubtitles:${SUBTITLES_KEY}`]);
    expect(JSON.stringify([...app.credentials.byUser.values()])).not.toContain(sampleKey("a91F"));
    const overview = await app.overview(ana);
    expect(overview.map((entry) => [entry.service, entry.own.state, entry.active])).toEqual([
      ["gemini", "ready", "own"],
      ["openai", "absent", "none"],
      ["anthropic", "absent", "none"],
      ["openrouter", "absent", "none"],
      ["ollama", "absent", "none"],
      ["openai_compatible", "absent", "none"],
      ["tmdb", "absent", "none"],
      ["opensubtitles", "ready", "own"],
    ]);
    expect(JSON.stringify(overview)).not.toContain(sampleKey("a91F"));
    expect(JSON.stringify(overview)).not.toContain(SUBTITLES_KEY);
  });

  it("prefere a chave do usuário e usa a global só quando ele não tem a sua", async () => {
    await app.save({ actor: dono, service: "tmdb", scope: "global", secret: TMDB_TOKEN });
    expect(await app.resolve("ana", "tmdb")).toEqual({ secret: TMDB_TOKEN, origin: "global" });
    expect(await app.resolve(null, "tmdb")).toEqual({ secret: TMDB_TOKEN, origin: "global" });
    await app.save({ actor: ana, service: "tmdb", scope: "user", secret: TMDB_KEY });
    expect(await app.resolve("ana", "tmdb")).toEqual({ secret: TMDB_KEY, origin: "user" });
    expect(await app.resolve("lucas", "tmdb")).toEqual({ secret: TMDB_TOKEN, origin: "global" });
    expect(await app.resolve("lucas", "gemini")).toBeNull();

    await app.remove({ actor: ana, service: "tmdb", scope: "user" });
    expect(await app.resolve("ana", "tmdb")).toEqual({ secret: TMDB_TOKEN, origin: "global" });
  });

  it("só o administrador altera a chave global, e só ele vê a versão mascarada dela", async () => {
    await expect(
      app.save({ actor: ana, service: "gemini", scope: "global", secret: sampleKey("a91F") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await app.save({ actor: dono, service: "gemini", scope: "global", secret: sampleKey("7Kc2") });
    await expect(app.remove({ actor: ana, service: "gemini", scope: "global" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const forAna = (await app.overview(ana)).find((entry) => entry.service === "gemini");
    expect(forAna).toMatchObject({ active: "global", global: { source: "database", stored: null } });
    expect(JSON.stringify(forAna)).not.toContain("7Kc2");
    const forOwner = (await app.overview(dono)).find((entry) => entry.service === "gemini");
    expect(forOwner?.global.stored).toEqual({ state: "ready", masked: "AIza••••••••7Kc2" });
  });

  it("chave definida no ambiente conta como global disponível", async () => {
    const withEnvironment = setup({ environment: ["opensubtitles"] });
    const entry = (await withEnvironment.overview(ana)).find((item) => item.service === "opensubtitles");
    expect(entry).toMatchObject({ active: "global", global: { source: "environment" } });
  });

  it("isola as chaves: cada usuário resolve só a sua, e remover uma não afeta a outra", async () => {
    await app.save({ actor: ana, service: "gemini", scope: "user", secret: sampleKey("a91F") });
    await app.save({
      actor: { userId: "lucas", isAdmin: false },
      service: "gemini",
      scope: "user",
      secret: sampleKey("7Kc2"),
    });
    expect((await app.resolve("ana", "gemini"))?.secret).toBe(sampleKey("a91F"));
    expect((await app.resolve("lucas", "gemini"))?.secret).toBe(sampleKey("7Kc2"));
    await app.remove({ actor: ana, service: "gemini", scope: "user" });
    expect(await app.resolve("ana", "gemini")).toBeNull();
    expect((await app.resolve("lucas", "gemini"))?.secret).toBe(sampleKey("7Kc2"));
  });

  it("com a chave mestra trocada, a chave guardada vira ilegível, é ignorada e gera alerta", async () => {
    await app.save({ actor: ana, service: "gemini", scope: "user", secret: sampleKey("a91F") });
    await app.save({ actor: dono, service: "tmdb", scope: "global", secret: TMDB_KEY });
    const rotated = setup({ masterKey: Buffer.alloc(32, 3).toString("base64") });
    for (const [key, value] of app.credentials.byUser) rotated.credentials.byUser.set(key, value);
    for (const [key, value] of app.credentials.global) rotated.credentials.global.set(key, value);

    expect(await rotated.resolve("ana", "gemini")).toBeNull();
    expect(await rotated.resolve("ana", "tmdb")).toBeNull();
    expect(unreadableCredentials(await rotated.overview(ana))).toEqual({
      own: ["Google AI (Gemini)"],
      global: [],
    });
    expect(unreadableCredentials(await rotated.overview(dono))).toEqual({ own: [], global: ["TMDB"] });

    await rotated.save({ actor: ana, service: "gemini", scope: "user", secret: sampleKey("a91F") });
    expect(unreadableCredentials(await rotated.overview(ana)).own).toEqual([]);
    expect((await rotated.resolve("ana", "gemini"))?.secret).toBe(sampleKey("a91F"));
  });
});
