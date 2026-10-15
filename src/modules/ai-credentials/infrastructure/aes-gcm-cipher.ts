import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KeyCipher } from "../application/ports";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PARTS = 4;
const CURRENT_VERSION = 1;

export class AesGcmCipher implements KeyCipher {
  readonly version = CURRENT_VERSION;
  private readonly key: Buffer;

  constructor(masterKeyBase64: string) {
    this.key = Buffer.from(masterKeyBase64, "base64");
    if (this.key.length !== KEY_BYTES) throw new Error("chave mestra precisa ter 32 bytes");
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [
      `v${this.version}`,
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      encrypted.toString("base64"),
    ].join(".");
  }

  decrypt(payload: string): string {
    const parts = payload.split(".");
    const [version, iv, tag, encrypted] = parts;
    if (parts.length !== PARTS || version !== `v${this.version}` || !iv || !tag || encrypted === undefined) {
      throw new Error("invalid encrypted key format");
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString(
      "utf8",
    );
  }
}
