import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { makeSaveCredential, type CredentialScope } from "../application/credential-use-cases";
import type { CredentialRepository, KeyCipher } from "../application/ports";
import {
  makeAssignAiModel,
  makeGetAssignedModel,
  makeListModelAssignments,
  makeSetAiModels,
  pickAiModel,
  type ModelChoiceRepository,
} from "../application/model-choice-use-cases";
import type { ModelChoice } from "./model-choice";
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
    const assigned = new Map<string, ModelChoice>();
    const choices: ModelChoiceRepository = {
      get: async (userId) => (saved.get(userId) as never) ?? null,
      save: async (userId, models) => {
        saved.set(userId, models);
      },
      getAssigned: async (userId) => assigned.get(userId) ?? null,
      listAssigned: async () => [...assigned].map(([userId, generation]) => ({ userId, generation })),
      saveAssigned: async (userId, generation) => {
        if (generation) assigned.set(userId, generation);
        else assigned.delete(userId);
      },
    };
    const deps = { choices, clock: new FixedClock("2026-10-13T12:00:00Z") };
    return {
      saved,
      set: makeSetAiModels(deps),
      assign: makeAssignAiModel(deps),
      list: makeListModelAssignments(deps),
      getAssigned: makeGetAssignedModel(deps),
    };
  }

  it("só o administrador define o modelo de outra pessoa; nulo volta ao padrão do servidor", async () => {
    const app = setup();
    const generation = { provider: "gemini", model: "gemini-2.5-flash-lite" };
    expect(
      await codeOf(app.assign({ actor: { userId: "ana", isAdmin: false }, userId: "ana", generation })),
    ).toBe("FORBIDDEN");
    expect(await codeOf(app.list({ userId: "ana", isAdmin: false }))).toBe("FORBIDDEN");
    await app.assign({ actor: { userId: "dono", isAdmin: true }, userId: "ana", generation });
    expect(await app.getAssigned("ana")).toEqual(generation);
    expect(await app.getAssigned("lucas")).toBeNull();
    expect(await app.list({ userId: "dono", isAdmin: true })).toEqual([{ userId: "ana", generation }]);
    expect(
      await codeOf(
        app.assign({
          actor: { userId: "dono", isAdmin: true },
          userId: "ana",
          generation: { provider: "x" },
        }),
      ),
    ).toBe("INVALID_INPUT");
    await app.assign({ actor: { userId: "dono", isAdmin: true }, userId: "ana", generation: null });
    expect(await app.getAssigned("ana")).toBeNull();
  });

  it("com a chave do servidor, o modelo do administrador vence a escolha da pessoa; com chave própria, não", async () => {
    const assigned = { provider: "gemini" as const, model: "gemini-2.5-flash-lite" };
    const chosen = { provider: "gemini" as const, model: "gemini-2.5-pro" };
    const serverDefault = { provider: "gemini" as const, model: "gemini-2.5-flash" };
    const pick = async (origin: "user" | "global", options: { assigned?: boolean } = {}) =>
      (
        await pickAiModel({
          chosen,
          assigned: options.assigned === false ? null : assigned,
          serverDefault,
          credentialFor: async () => ({ origin }),
          isShared: (credential) => credential.origin === "global",
        })
      )?.choice;
    expect(await pick("global")).toEqual(assigned);
    expect(await pick("user")).toEqual(chosen);
    expect(await pick("global", { assigned: false })).toEqual(chosen);
    expect(
      await pickAiModel({
        chosen: null,
        assigned: null,
        serverDefault,
        credentialFor: async () => null,
        isShared: () => true,
      }),
    ).toBeNull();
  });

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
