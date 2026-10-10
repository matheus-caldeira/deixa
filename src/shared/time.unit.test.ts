import { describe, expect, it } from "vitest";
import { formatTimecode, localDateKey, startOfLocalDay } from "./time";

describe("formatTimecode", () => {
  it("formata milissegundos como hh:mm:ss", () => {
    expect(formatTimecode(65_220)).toBe("00:01:05");
    expect(formatTimecode(3_723_000)).toBe("01:02:03");
  });
});

describe("dia local do usuário", () => {
  it("usa o fuso da conta para decidir o dia", () => {
    const lateNightInSaoPaulo = new Date("2026-10-11T01:30:00Z");
    expect(localDateKey(lateNightInSaoPaulo, "America/Sao_Paulo")).toBe("2026-10-10");
    expect(localDateKey(lateNightInSaoPaulo, "UTC")).toBe("2026-10-11");
  });

  it("calcula o início do dia no fuso", () => {
    const instant = new Date("2026-10-10T15:00:00Z");
    expect(startOfLocalDay(instant, "America/Sao_Paulo").toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });
});
