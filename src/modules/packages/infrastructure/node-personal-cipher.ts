import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import type { PersonalCipher } from "../application/ports";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HEADER_BYTES = 1 + SALT_BYTES + IV_BYTES;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

async function deriveKey(email: string, password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(`${normalizeEmail(email)}\n${password}`, salt, KEY_BYTES, SCRYPT);
}

export class NodePersonalCipher implements PersonalCipher {
  async seal(plain: Uint8Array, email: string, password: string): Promise<Uint8Array> {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const key = await deriveKey(email, password, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from([VERSION]));
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), salt, iv, cipher.getAuthTag(), encrypted]);
  }

  async open(sealed: Uint8Array, email: string, password: string): Promise<Uint8Array | null> {
    if (sealed.length < HEADER_BYTES + TAG_BYTES || sealed[0] !== VERSION) return null;
    const buffer = Buffer.from(sealed);
    const salt = buffer.subarray(1, 1 + SALT_BYTES);
    const iv = buffer.subarray(1 + SALT_BYTES, HEADER_BYTES);
    const tag = buffer.subarray(HEADER_BYTES, HEADER_BYTES + TAG_BYTES);
    const encrypted = buffer.subarray(HEADER_BYTES + TAG_BYTES);
    try {
      const key = await deriveKey(email, password, salt);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from([VERSION]));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch {
      return null;
    }
  }
}
