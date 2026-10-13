import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { isAppError } from "@/shared/errors";
import { generateJson, type JsonRequest } from "./generate-json";

const request: JsonRequest = {
  access: { provider: "google", apiKey: "k" },
  model: "gemini-2.5-flash",
  system: "Responda em JSON.",
  messages: [{ role: "user", content: "[]" }],
  timeoutMs: 1000,
  temperature: 0,
};

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const stop = { unified: "stop" as const, raw: "STOP" };

function answering(text: string) {
  return new MockLanguageModelV4({
    doGenerate: { content: [{ type: "text", text }], finishReason: stop, usage, warnings: [] },
  });
}

function failing(statusCode: number) {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({ message: `erro ${statusCode}`, url: "u", requestBodyValues: {}, statusCode });
    },
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return isAppError(error) ? error.code : "unexpected";
  }
}

describe("generateJson", () => {
  it("devolve o JSON gerado pelo modelo pedido", async () => {
    const asked: string[] = [];
    const result = await generateJson(request, (_, id) => {
      asked.push(id);
      return answering('{"ok":true}');
    });
    expect(result).toEqual({ ok: true });
    expect(asked).toEqual(["gemini-2.5-flash"]);
  });

  it("passa ao modelo de reserva quando o pedido falha com 429", async () => {
    const asked: string[] = [];
    const result = await generateJson(request, (_, id) => {
      asked.push(id);
      return id === request.model ? failing(429) : answering("[1]");
    });
    expect(result).toEqual([1]);
    expect(asked).toEqual(["gemini-2.5-flash", "gemini-flash-latest"]);
  });

  it("acusa chave recusada sem tentar outro modelo", async () => {
    const asked: string[] = [];
    const code = await codeOf(
      generateJson(request, (_, id) => {
        asked.push(id);
        return failing(403);
      }),
    );
    expect(code).toBe("AI_KEY_REJECTED");
    expect(asked).toEqual(["gemini-2.5-flash"]);
  });

  it("acusa cota esgotada quando todos os modelos respondem 429", async () => {
    const code = await codeOf(generateJson(request, () => failing(429)));
    expect(code).toBe("LLM_FAILED");
  });

  it("acusa resposta fora do formato", async () => {
    const code = await codeOf(generateJson(request, () => answering("isto não é json")));
    expect(code).toBe("LLM_INVALID_OUTPUT");
  });
});
