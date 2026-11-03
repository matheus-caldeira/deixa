import { describe, expect, it } from "vitest";
import { internalPath } from "./internal-path";

describe("internalPath", () => {
  it("keeps a path of the app with query and fragment", () => {
    expect(internalPath("/trail?id=abc&season=2")).toBe("/trail?id=abc&season=2");
    expect(internalPath("/transfer#importar")).toBe("/transfer#importar");
    expect(internalPath("/")).toBe("/");
  });

  it("refuses a path that only becomes protocol-relative after normalization", () => {
    for (const candidate of ["/.//evil.com", "/a/..//evil.com", "/%2e//evil.com"]) {
      expect(internalPath(candidate)).toBeNull();
    }
  });

  it("refuses anything that could leave the app", () => {
    for (const candidate of [
      "//evil.example/x",
      "https://evil.example",
      "javascript:alert(1)",
      "trail",
      "/\\evil.example",
      "/a b",
      "/a\nb",
      "",
      null,
      42,
      `/${"a".repeat(3000)}`,
    ]) {
      expect(internalPath(candidate)).toBeNull();
    }
  });
});
