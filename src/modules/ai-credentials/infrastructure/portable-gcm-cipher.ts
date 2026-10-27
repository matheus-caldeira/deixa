import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { base64ToBytes, bytesToBase64 } from "@/shared/base64";
import type { KeyCipher } from "../application/ports";

const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;
const PARTS = 4;
const CURRENT_VERSION = 1;

export class PortableGcmCipher implements KeyCipher {
  readonly version = CURRENT_VERSION;
  private readonly key: Uint8Array;

  constructor(masterKeyBase64: string) {
    this.key = base64ToBytes(masterKeyBase64);
    if (this.key.length !== KEY_BYTES) throw new Error("master key must have 32 bytes");
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const sealed = gcm(this.key, iv).encrypt(new TextEncoder().encode(plain));
    const encrypted = sealed.subarray(0, sealed.length - TAG_BYTES);
    const tag = sealed.subarray(sealed.length - TAG_BYTES);
    return [`v${this.version}`, bytesToBase64(iv), bytesToBase64(tag), bytesToBase64(encrypted)].join(".");
  }

  decrypt(payload: string): string {
    const parts = payload.split(".");
    const [version, iv, tag, encrypted] = parts;
    if (parts.length !== PARTS || version !== `v${this.version}` || !iv || !tag || encrypted === undefined) {
      throw new Error("invalid encrypted key format");
    }
    const sealed = new Uint8Array([...base64ToBytes(encrypted), ...base64ToBytes(tag)]);
    return new TextDecoder().decode(gcm(this.key, base64ToBytes(iv)).decrypt(sealed));
  }
}
