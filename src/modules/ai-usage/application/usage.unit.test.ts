import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { estimateCostUsd, findDefaultPrice } from "../domain/usage";
import { makeRecordAiUsage, meterFor } from "./record-ai-usage";
import { InMemoryAiUsageRepository, InMemoryModelPriceRepository } from "./testing/fakes";

function setup() {
  const usage = new InMemoryAiUsageRepository();
  const prices = new InMemoryModelPriceRepository();
  const clock = new FixedClock("2026-10-13T12:00:00Z");
  const record = makeRecordAiUsage({ usage, prices, clock, ids: new SequentialIds("evt") });
  return { usage, prices, clock, record };
}

describe("estimateCostUsd", () => {
  it("cobra entrada e saída pelo preço por milhão de tokens", () => {
    const price = { provider: "gemini", model: "m", inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5 };
    expect(estimateCostUsd(price, { inputTokens: 1_000_000, outputTokens: 200_000 })).toBeCloseTo(0.8);
  });

  it("sem preço o valor é desconhecido, nunca zero", () => {
    expect(estimateCostUsd(null, { inputTokens: 10, outputTokens: 10 })).toBeNull();
    expect(findDefaultPrice("gemini", "modelo-inexistente")).toBeNull();
  });
});

describe("recordAiUsage", () => {
  it("grava um evento por chamada com o custo estimado pelo preço padrão", async () => {
    const { usage, record } = setup();
    await record({
      userId: "ana",
      keySource: "user",
      provider: "gemini",
      model: "gemini-2.5-flash",
      operation: "cards",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(usage.events).toHaveLength(1);
    expect(usage.events[0]).toMatchObject({ id: "evt-1", userId: "ana", operation: "cards" });
    expect(usage.events[0]?.estimatedCostUsd).toBeCloseTo(0.0028);
  });

  it("o preço cadastrado pelo administrador vence o padrão", async () => {
    const { usage, prices, record, clock } = setup();
    await prices.save(
      { provider: "gemini", model: "gemini-2.5-flash", inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
      "admin",
      clock.now(),
    );
    await record({
      userId: "ana",
      keySource: "global",
      provider: "gemini",
      model: "gemini-2.5-flash",
      operation: "tutor",
      inputTokens: 500_000,
      outputTokens: 500_000,
    });
    expect(usage.events[0]?.estimatedCostUsd).toBeCloseTo(1);
  });

  it("o medidor de um usuário só registra no nome dele", async () => {
    const { usage, record } = setup();
    const allow = async () => undefined;
    const ana = meterFor(record, allow, "ana", "user");
    const lucas = meterFor(record, allow, "lucas", "global");
    const call = {
      provider: "gemini",
      model: "x",
      operation: "embeddings" as const,
      inputTokens: 5,
      outputTokens: 0,
    };
    await ana.record(call);
    await lucas.record(call);
    expect((await usage.listEvents("ana", new Date(0))).map((event) => event.keySource)).toEqual(["user"]);
    expect((await usage.listEvents("lucas", new Date(0))).map((event) => event.keySource)).toEqual([
      "global",
    ]);
  });
});
