import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { RecordingMeter } from "@/modules/ai-usage/application/testing/fakes";
import { isAppError } from "@/shared/errors";
import { generateJson, type JsonRequest, type ModelFactory } from "./generate-json";

const request: JsonRequest = {
  access: { provider: "gemini", apiKey: "k", baseUrl: null },
  model: "gemini-2.5-flash",
  system: "Responda em JSON.",
  messages: [{ role: "user", content: "[]" }],
  timeoutMs: 1000,
  temperature: 0,
};

const usage = {
  inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 30, text: 30, reasoning: 0 },
};

function run(createModel: ModelFactory, meter = new RecordingMeter()) {
  return generateJson(request, "cards", { createModel, meter });
}
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
    const meter = new RecordingMeter();
    const result = await run((_, id) => {
      asked.push(id);
      return answering('{"ok":true}');
    }, meter);
    expect(result).toEqual({ ok: true });
    expect(asked).toEqual(["gemini-2.5-flash"]);
    expect(meter.checks).toBe(1);
    expect(meter.calls).toEqual([
      {
        provider: "gemini",
        model: "gemini-2.5-flash",
        operation: "cards",
        inputTokens: 120,
        outputTokens: 30,
      },
    ]);
  });

  it("passa ao modelo de reserva quando o pedido falha com 429", async () => {
    const asked: string[] = [];
    const meter = new RecordingMeter();
    const result = await run((_, id) => {
      asked.push(id);
      return id === request.model ? failing(429) : answering("[1]");
    }, meter);
    expect(result).toEqual([1]);
    expect(asked).toEqual(["gemini-2.5-flash", "gemini-flash-latest"]);
    expect(meter.calls.map((call) => call.model)).toEqual(["gemini-flash-latest"]);
  });

  it("acusa chave recusada sem tentar outro modelo", async () => {
    const asked: string[] = [];
    const code = await codeOf(
      run((_, id) => {
        asked.push(id);
        return failing(403);
      }),
    );
    expect(code).toBe("AI_KEY_REJECTED");
    expect(asked).toEqual(["gemini-2.5-flash"]);
  });

  it("acusa cota esgotada quando todos os modelos respondem 429", async () => {
    const code = await codeOf(run(() => failing(429)));
    expect(code).toBe("LLM_FAILED");
  });

  it("acusa resposta fora do formato", async () => {
    const meter = new RecordingMeter();
    const code = await codeOf(run(() => answering("isto não é json"), meter));
    expect(code).toBe("LLM_INVALID_OUTPUT");
    expect(meter.calls).toEqual([]);
  });
});
