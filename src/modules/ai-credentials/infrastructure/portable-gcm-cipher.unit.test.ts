import { describe, expect, it } from "vitest";
import { AesGcmCipher } from "./aes-gcm-cipher";
import { PortableGcmCipher } from "./portable-gcm-cipher";

const MASTER = Buffer.alloc(32, 7).toString("base64");

describe("cifra portável da chave de IA", () => {
  it("abre o que o Node cifrou e o Node abre o que ela cifrou", () => {
    const node = new AesGcmCipher(MASTER);
    const portable = new PortableGcmCipher(MASTER);
    expect(portable.decrypt(node.encrypt("chave-secreta"))).toBe("chave-secreta");
    expect(node.decrypt(portable.encrypt("outra-chave"))).toBe("outra-chave");
  });

  it("recusa conteúdo adulterado", () => {
    const portable = new PortableGcmCipher(MASTER);
    const [version, iv, tag, encrypted] = portable.encrypt("chave").split(".");
    const flipped = `${encrypted?.startsWith("A") ? "B" : "A"}${encrypted?.slice(1)}`;
    expect(() => portable.decrypt([version, iv, tag, flipped].join("."))).toThrow();
  });
});
