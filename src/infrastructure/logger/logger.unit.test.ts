import { describe, expect, it } from "vitest";
import { redact } from "./logger";

describe("redaction do logger", () => {
  it("esconde campos sensíveis em qualquer profundidade", () => {
    const output = redact({
      provider: "tmdb",
      headers: { Authorization: "Bearer abc", accept: "json" },
      user: { email: "a@example.com", passwordHash: "x", apiKey: "y" },
      items: [{ token: "z", count: 2 }],
    });
    expect(output).toEqual({
      provider: "tmdb",
      headers: { Authorization: "[redacted]", accept: "json" },
      user: { email: "a@example.com", passwordHash: "[redacted]", apiKey: "[redacted]" },
      items: [{ token: "[redacted]", count: 2 }],
    });
  });
});
