import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import type { PersonalCipher } from "../application/ports";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const VERSION = 2;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const LOG2_N = 17;
const MIN_LOG2_N = 14;
const MAX_LOG2_N = 20;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const MAXMEM_SLACK = 2;
const HEADER_BYTES = 2 + SALT_BYTES + IV_BYTES;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

async function deriveKey(email: string, password: string, salt: Buffer, log2N: number): Promise<Buffer> {
  const N = 2 ** log2N;
  return scryptAsync(`${normalizeEmail(email)}\n${password}`, salt, KEY_BYTES, {
    N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAXMEM_SLACK * 128 * N * SCRYPT_R,
  });
}

export class NodePersonalCipher implements PersonalCipher {
  async seal(plain: Uint8Array, email: string, password: string): Promise<Uint8Array> {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const header = Buffer.from([VERSION, LOG2_N]);
    const key = await deriveKey(email, password, salt, LOG2_N);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(header);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([header, salt, iv, cipher.getAuthTag(), encrypted]);
  }

  async open(sealed: Uint8Array, email: string, password: string): Promise<Uint8Array | null> {
    if (sealed.length < HEADER_BYTES + TAG_BYTES || sealed[0] !== VERSION) return null;
    const log2N = sealed[1] ?? 0;
    if (log2N < MIN_LOG2_N || log2N > MAX_LOG2_N) return null;
    const buffer = Buffer.from(sealed);
    const header = buffer.subarray(0, 2);
    const salt = buffer.subarray(2, 2 + SALT_BYTES);
    const iv = buffer.subarray(2 + SALT_BYTES, HEADER_BYTES);
    const tag = buffer.subarray(HEADER_BYTES, HEADER_BYTES + TAG_BYTES);
    const encrypted = buffer.subarray(HEADER_BYTES + TAG_BYTES);
    try {
      const key = await deriveKey(email, password, salt, log2N);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(header);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch {
      return null;
    }
  }
}
