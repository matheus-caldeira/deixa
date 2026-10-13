import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { makeSaveCredential, type CredentialScope } from "../application/credential-use-cases";
import type { CredentialRepository, KeyCipher } from "../application/ports";
import { makeSetAiModels, type ModelChoiceRepository } from "../application/model-choice-use-cases";
import { maskSecret } from "./api-key";
import { endpointSecret, looksLikeSecret, parseEndpoint } from "./services";

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return isAppError(error) ? error.code : "unexpected";
  }
}

describe("segredos por provedor", () => {
  it("reconhece a forma da chave de cada provedor", () => {
    expect(looksLikeSecret("openai", "sk-abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(looksLikeSecret("openai", "sk-ant-abcdefghijklmnopqrstuvwxyz")).toBe(false);
    expect(looksLikeSecret("anthropic", "sk-ant-abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(looksLikeSecret("openrouter", "sk-or-abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(looksLikeSecret("gemini", "sk-or-abcdefghijklmnopqrstuvwxyz")).toBe(false);
  });

  it("endereço vira segredo em JSON, com URL canônica e sem endereços internos de metadados", () => {
    const secret = endpointSecret({ baseUrl: "http://localhost:11434/", apiKey: null });
    expect(looksLikeSecret("ollama", secret)).toBe(true);
    expect(parseEndpoint(secret)).toEqual({ baseUrl: "http://localhost:11434", apiKey: null });
    expect(parseEndpoint(endpointSecret({ baseUrl: "http://169.254.169.254/", apiKey: null }))).toBeNull();
    expect(parseEndpoint(endpointSecret({ baseUrl: "ftp://x", apiKey: null }))).toBeNull();
    expect(parseEndpoint("http://localhost:11434")).toBeNull();
    expect(parseEndpoint(endpointSecret({ baseUrl: "https://srv/v1", apiKey: "com espaço" }))).toBeNull();
  });

  it("a máscara mostra o endereço e esconde a chave", () => {
    expect(
      maskSecret("openai_compatible", endpointSecret({ baseUrl: "https://srv/v1", apiKey: "k1234567890" })),
    ).toBe("https://srv/v1 · chave ••••••••");
    expect(maskSecret("ollama", endpointSecret({ baseUrl: "http://localhost:11434", apiKey: null }))).toBe(
      "http://localhost:11434",
    );
    expect(maskSecret("openai", "sk-abcdefghijklmnop")).toBe("sk-a••••••••mnop");
  });
});

describe("escolha de modelos", () => {
  function setup() {
    const saved = new Map<string, unknown>();
    const choices: ModelChoiceRepository = {
      get: async (userId) => (saved.get(userId) as never) ?? null,
      save: async (userId, models) => {
        saved.set(userId, models);
      },
    };
    return { saved, set: makeSetAiModels({ choices, clock: new FixedClock("2026-10-13T12:00:00Z") }) };
  }

  it("guarda provedor e modelo por conta; embeddings aceitam cálculo local", async () => {
    const app = setup();
    const models = {
      generation: { provider: "openai", model: "gpt-4o-mini" },
      embedding: "local",
    };
    expect(await app.set({ userId: "ana", models })).toEqual(models);
    expect(app.saved.get("ana")).toEqual(models);
  });

  it("recusa provedor desconhecido, modelo fora do formato e embeddings na Anthropic", async () => {
    const app = setup();
    for (const models of [
      { generation: { provider: "x", model: "m" }, embedding: null },
      { generation: { provider: "openai", model: "tem espaço" }, embedding: null },
      { generation: null, embedding: { provider: "anthropic", model: "claude" } },
    ]) {
      expect(await codeOf(app.set({ userId: "ana", models }))).toBe("INVALID_INPUT");
    }
  });
});

describe("endereço próprio de IA", () => {
  function setup(allowed: boolean) {
    const saved: string[] = [];
    const credentials = {
      upsertForUser: async (_userId: string, service: string) => {
        saved.push(service);
      },
      upsertGlobal: async (service: string) => {
        saved.push(`global:${service}`);
      },
    } as unknown as CredentialRepository;
    const cipher: KeyCipher = {
      version: 1,
      encrypt: (plain) => `enc:${plain}`,
      decrypt: (value) => value.slice(4),
    };
    const save = makeSaveCredential({
      credentials,
      cipher,
      testCredential: async () => true,
      environmentServices: new Set(),
      endpointsAllowed: async () => allowed,
      clock: new FixedClock("2026-10-13T12:00:00Z"),
    });
    const secret = endpointSecret({ baseUrl: "http://localhost:11434", apiKey: null });
    const attempt = (isAdmin: boolean, scope: CredentialScope) =>
      save({ actor: { userId: "u", isAdmin }, service: "ollama", scope, secret });
    return { saved, attempt };
  }

  it("com a opção desligada, só o administrador guarda um endereço", async () => {
    const off = setup(false);
    expect(await codeOf(off.attempt(false, "user"))).toBe("FORBIDDEN");
    expect(off.saved).toEqual([]);
    expect(await codeOf(off.attempt(true, "global"))).toBe("ok");
    const on = setup(true);
    expect(await codeOf(on.attempt(false, "user"))).toBe("ok");
    expect(on.saved).toEqual(["ollama"]);
  });
});
