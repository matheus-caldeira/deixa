import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { looksLikeGoogleApiKey, maskApiKey } from "../domain/api-key";
import { AesGcmCipher } from "../infrastructure/aes-gcm-cipher";
import {
  makeGetKeyStatus,
  makeRemoveApiKey,
  makeResolveApiKey,
  makeSaveApiKey,
} from "./credential-use-cases";
import type { CredentialRepository, StoredCredential } from "./ports";

const MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
const sampleKey = (suffix: string) => `AIza${"x".repeat(31)}${suffix}`;

class InMemoryCredentials implements CredentialRepository {
  readonly rows = new Map<string, StoredCredential>();

  async get(userId: string): Promise<StoredCredential | null> {
    return this.rows.get(userId) ?? null;
  }

  async upsert(userId: string, credential: StoredCredential): Promise<void> {
    this.rows.set(userId, { encryptedApiKey: credential.encryptedApiKey, keyVersion: credential.keyVersion });
  }

  async delete(userId: string): Promise<void> {
    this.rows.delete(userId);
  }
}

function setup(accepts = true) {
  const credentials = new InMemoryCredentials();
  const tested: string[] = [];
  const deps = {
    credentials,
    cipher: new AesGcmCipher(MASTER_KEY),
    clock: new FixedClock("2026-10-10T12:00:00Z"),
    testApiKey: async (apiKey: string) => {
      tested.push(apiKey);
      return accepts;
    },
  };
  return {
    credentials,
    tested,
    save: makeSaveApiKey(deps),
    status: makeGetKeyStatus(deps),
    remove: makeRemoveApiKey(deps),
    resolve: makeResolveApiKey(deps),
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

describe("chave de IA por usuário", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("valida o formato antes de testar a chave", async () => {
    expect(looksLikeGoogleApiKey(sampleKey("a91F"))).toBe(true);
    expect(looksLikeGoogleApiKey("sk-qualquer-coisa")).toBe(false);
    await expect(app.save("ana", "chave-errada")).rejects.toMatchObject({ code: "AI_KEY_INVALID" });
    expect(app.tested).toEqual([]);
  });

  it("testa, cifra e devolve só a versão mascarada", async () => {
    const status = await app.save("ana", `  ${sampleKey("a91F")}  `);
    expect(status).toEqual({ connected: true, masked: "AIza••••••••a91F" });
    expect(app.tested).toEqual([sampleKey("a91F")]);
    const stored = app.credentials.rows.get("ana");
    expect(stored?.encryptedApiKey).not.toContain(sampleKey("a91F"));
    expect(stored?.keyVersion).toBe(1);
    expect(await app.status("ana")).toEqual({ connected: true, masked: "AIza••••••••a91F" });
    expect(JSON.stringify(await app.status("ana"))).not.toContain(sampleKey("a91F"));
  });

  it("não salva a chave que o provedor recusa", async () => {
    const rejecting = setup(false);
    await expect(rejecting.save("ana", sampleKey("a91F"))).rejects.toMatchObject({ code: "AI_KEY_REJECTED" });
    expect(rejecting.credentials.rows.size).toBe(0);
  });

  it("isola as chaves: cada usuário resolve só a sua, e remover uma não afeta a outra", async () => {
    await app.save("matheus", sampleKey("a91F"));
    await app.save("lucas", sampleKey("7Kc2"));
    expect(await app.resolve("matheus")).toBe(sampleKey("a91F"));
    expect(await app.resolve("lucas")).toBe(sampleKey("7Kc2"));
    expect(await app.resolve("ana")).toBeNull();
    expect(await app.status("ana")).toEqual({ connected: false, masked: null });

    await app.remove("matheus");
    expect(await app.resolve("matheus")).toBeNull();
    expect(await app.status("lucas")).toEqual({ connected: true, masked: "AIza••••••••7Kc2" });
  });

  it("mascara chaves curtas por inteiro", () => {
    expect(maskApiKey("abcdefgh")).toBe("••••••••");
  });
});
