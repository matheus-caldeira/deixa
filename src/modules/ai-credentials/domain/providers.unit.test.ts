import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
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
