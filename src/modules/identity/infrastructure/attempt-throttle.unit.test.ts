import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { AttemptThrottle } from "./attempt-throttle";

describe("limite de tentativas de login", () => {
  it("bloqueia depois do limite, por chave, e libera quando a janela passa ou o login dá certo", () => {
    const clock = new FixedClock("2026-10-10T12:00:00Z");
    const throttle = new AttemptThrottle(3, 60_000, clock);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(throttle.isBlocked("ana@example.com")).toBe(false);
      throttle.recordFailure("ana@example.com");
    }
    expect(throttle.isBlocked("ana@example.com")).toBe(true);
    expect(throttle.isBlocked("lucas@example.com")).toBe(false);
    clock.advanceMs(61_000);
    expect(throttle.isBlocked("ana@example.com")).toBe(false);
    throttle.recordFailure("ana@example.com");
    throttle.reset("ana@example.com");
    expect(throttle.isBlocked("ana@example.com")).toBe(false);
  });
});
