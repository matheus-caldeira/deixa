import { describe, expect, it } from "vitest";
import { NodePersonalCipher } from "./node-personal-cipher";

describe("cifra dos dados pessoais", () => {
  it("abre com o e-mail (em qualquer caixa) e a senha certos; senha errada e arquivo mexido dão o mesmo nada", async () => {
    const cipher = new NodePersonalCipher();
    const plain = new TextEncoder().encode('{"ok":true}');
    const sealed = await cipher.seal(plain, "Ana@Example.com", "segredo123");
    expect(
      new TextDecoder().decode(
        (await cipher.open(sealed, "ana@example.com", "segredo123")) ?? new Uint8Array(),
      ),
    ).toBe('{"ok":true}');
    expect(await cipher.open(sealed, "ana@example.com", "outra")).toBeNull();
    expect(await cipher.open(sealed, "lucas@example.com", "segredo123")).toBeNull();
    const tampered = new Uint8Array(sealed);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    expect(await cipher.open(tampered, "ana@example.com", "segredo123")).toBeNull();
    expect(await cipher.open(new Uint8Array([9, 9, 9]), "ana@example.com", "segredo123")).toBeNull();
  }, 20_000);
});
