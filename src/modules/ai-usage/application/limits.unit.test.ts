import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { SequentialIds } from "@/shared/ids";
import { NO_LIMIT } from "../domain/limits";
import { makeRecordAiUsage, meterFor, safeTokenCount } from "./record-ai-usage";
import { makeEnsureAiAllowed, makeSetAiUsageLimit } from "./usage-limits";
import { makeGetAiUsageOverview, makeGetAiUsageSummary } from "./usage-summary";
import {
  InMemoryAiUsageRepository,
  InMemoryModelPriceRepository,
  InMemoryUsageLimitRepository,
  person,
} from "./testing/fakes";

function setup(keySources: Record<string, "user" | "global" | null> = { ana: "user", lucas: "global" }) {
  const usage = new InMemoryAiUsageRepository();
  const prices = new InMemoryModelPriceRepository();
  const limits = new InMemoryUsageLimitRepository();
  const clock = new FixedClock("2026-10-13T15:00:00Z");
  let shared = { ...NO_LIMIT };
  const deps = {
    usage,
    prices,
    limits,
    clock,
    sharedDefault: async () => shared,
    personOf: async (id: string) => (id in keySources ? person(id) : null),
    keySourceOf: async (id: string) => keySources[id] ?? null,
    listPeople: async () => Object.keys(keySources).map((id) => person(id)),
  };
  const record = makeRecordAiUsage({ usage, prices, clock, ids: new SequentialIds("evt") });
  const ensure = makeEnsureAiAllowed(deps);
  return {
    clock,
    limits,
    setShared: (limit: typeof shared) => {
      shared = limit;
    },
    meter: (id: string) => meterFor(record, ensure, id, keySources[id] ?? "user"),
    setLimit: makeSetAiUsageLimit(deps),
    summary: makeGetAiUsageSummary(deps),
    overview: makeGetAiUsageOverview(deps),
  };
}

const call = { provider: "gemini", model: "gemini-2.5-flash", operation: "cards" as const };
const spend = (inputTokens: number) => ({ ...call, inputTokens, outputTokens: 0 });

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return isAppError(error) ? error.code : "unexpected";
  }
}

describe("limite de uso da IA", () => {
  it("tokens do provedor fora do esperado viram zero, nunca NaN nem negativo", () => {
    expect(safeTokenCount(Number.NaN)).toBe(0);
    expect(safeTokenCount(-5)).toBe(0);
    expect(safeTokenCount(undefined)).toBe(0);
    expect(safeTokenCount(12.7)).toBe(12);
  });

  it("sem limite nada é bloqueado; com limite, a chamada que cruza termina e a seguinte é recusada", async () => {
    const app = setup();
    const ana = app.meter("ana");
    await ana.ensureAllowed();
    await app.setLimit({
      actor: { userId: "ana", isAdmin: false },
      target: { scope: "own" },
      limit: { ...NO_LIMIT, usdPerDay: 0.001 },
    });
    await ana.ensureAllowed();
    await ana.record(spend(5_000_000));
    expect(await codeOf(ana.ensureAllowed())).toBe("AI_LIMIT_REACHED");
    const summary = await app.summary("ana");
    expect(summary.state.blocked).toBe("day");
    expect(summary.today.usd).toBeCloseTo(1.5);
  });

  it("o limite de um usuário não bloqueia o outro", async () => {
    const app = setup();
    await app.setLimit({
      actor: { userId: "ana", isAdmin: false },
      target: { scope: "own" },
      limit: { ...NO_LIMIT, tokensPerDay: 10 },
    });
    await app.meter("ana").record(spend(10));
    expect(await codeOf(app.meter("ana").ensureAllowed())).toBe("AI_LIMIT_REACHED");
    expect(await codeOf(app.meter("lucas").ensureAllowed())).toBe("ok");
  });

  it("quem usa a chave global recebe o limite padrão do servidor, e o administrador pode dar um próprio", async () => {
    const app = setup();
    app.setShared({ ...NO_LIMIT, tokensPerMonth: 100 });
    const lucas = app.meter("lucas");
    await lucas.record(spend(100));
    expect(await codeOf(lucas.ensureAllowed())).toBe("AI_LIMIT_REACHED");
    expect((await app.summary("lucas")).ownsLimit).toBe(false);
    expect(
      await codeOf(
        app.setLimit({
          actor: { userId: "lucas", isAdmin: false },
          target: { scope: "shared", userId: "lucas" },
          limit: NO_LIMIT,
        }),
      ),
    ).toBe("FORBIDDEN");
    await app.setLimit({
      actor: { userId: "ana", isAdmin: true },
      target: { scope: "shared", userId: "lucas" },
      limit: { ...NO_LIMIT, tokensPerMonth: 1000 },
    });
    expect(await codeOf(lucas.ensureAllowed())).toBe("ok");
  });

  it("o limite do dia vira à meia-noite do fuso do usuário", async () => {
    const app = setup();
    await app.setLimit({
      actor: { userId: "ana", isAdmin: false },
      target: { scope: "own" },
      limit: { ...NO_LIMIT, tokensPerDay: 10 },
    });
    await app.meter("ana").record(spend(10));
    expect(await codeOf(app.meter("ana").ensureAllowed())).toBe("AI_LIMIT_REACHED");
    app.clock.advanceMs(13 * 60 * 60 * 1000);
    expect(await codeOf(app.meter("ana").ensureAllowed())).toBe("ok");
  });

  it("o resumo quebra o mês por operação e por modelo e a semana termina hoje", async () => {
    const app = setup();
    const ana = app.meter("ana");
    await ana.record(spend(1_000_000));
    await ana.record({ ...spend(1_000_000), operation: "tutor", model: "modelo-sem-preco" });
    const summary = await app.summary("ana");
    expect(summary.byOperation.map((entry) => entry.operation)).toEqual(["cards", "tutor"]);
    expect(summary.byModel.map((entry) => entry.model)).toEqual(["gemini-2.5-flash", "modelo-sem-preco"]);
    expect(summary.month.unknownCostCalls).toBe(1);
    expect(summary.week).toHaveLength(7);
    expect(summary.week[6]).toBeCloseTo(0.3);
  });

  it("a visão do administrador mostra totais por pessoa, sem o detalhe, e só para o administrador", async () => {
    const app = setup();
    await app.meter("ana").record(spend(1_000_000));
    await app.meter("lucas").record(spend(2_000_000));
    expect(await codeOf(app.overview({ userId: "lucas", isAdmin: false }))).toBe("FORBIDDEN");
    const overview = await app.overview({ userId: "ana", isAdmin: true });
    expect(overview.totalMonthUsd).toBeCloseTo(0.9);
    expect(overview.people.map((entry) => [entry.person.id, entry.keySource])).toEqual([
      ["ana", "user"],
      ["lucas", "global"],
    ]);
    expect(
      overview.prices.some((price) => price.model === "gemini-2.5-flash" && price.source === "default"),
    ).toBe(true);
  });
});
