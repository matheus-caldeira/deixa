import { describe, expect, it } from "vitest";
import { NodePersonalCipher } from "./node-personal-cipher";
import { PortablePersonalCipher } from "./portable-personal-cipher";

const plain = new TextEncoder().encode("dados pessoais");

describe("cifra portável do pacote pessoal", () => {
  it("abre o pacote do Node e o Node abre o dela", async () => {
    const node = new NodePersonalCipher();
    const portable = new PortablePersonalCipher();
    const fromNode = await node.seal(plain, "Ana@Example.com", "segredo123");
    expect(await portable.open(fromNode, "ana@example.com", "segredo123")).toEqual(plain);
    const fromPortable = await portable.seal(plain, "ana@example.com", "segredo123");
    expect(new Uint8Array((await node.open(fromPortable, "ana@example.com", "segredo123")) ?? [])).toEqual(
      plain,
    );
    expect(await portable.open(fromNode, "ana@example.com", "errada")).toBeNull();
  }, 30_000);
});
