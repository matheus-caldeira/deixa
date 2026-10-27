import { gcm } from "@noble/ciphers/aes.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { concatBytes, randomBytes } from "@noble/hashes/utils.js";
import type { PersonalCipher } from "../application/ports";

const VERSION = 2;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const LOG2_N = 17;
const MIN_LOG2_N = 14;
const MAX_LOG2_N = 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const HEADER_BYTES = 2 + SALT_BYTES + IV_BYTES;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function deriveKey(email: string, password: string, salt: Uint8Array, log2N: number): Promise<Uint8Array> {
  return scryptAsync(`${normalizeEmail(email)}\n${password}`, salt, {
    N: 2 ** log2N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: KEY_BYTES,
  });
}

export class PortablePersonalCipher implements PersonalCipher {
  async seal(plain: Uint8Array, email: string, password: string): Promise<Uint8Array> {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const header = new Uint8Array([VERSION, LOG2_N]);
    const key = await deriveKey(email, password, salt, LOG2_N);
    const sealed = gcm(key, iv, header).encrypt(plain);
    const encrypted = sealed.subarray(0, sealed.length - TAG_BYTES);
    const tag = sealed.subarray(sealed.length - TAG_BYTES);
    return concatBytes(header, salt, iv, tag, encrypted);
  }

  async open(sealed: Uint8Array, email: string, password: string): Promise<Uint8Array | null> {
    if (sealed.length < HEADER_BYTES + TAG_BYTES || sealed[0] !== VERSION) return null;
    const log2N = sealed[1] ?? 0;
    if (log2N < MIN_LOG2_N || log2N > MAX_LOG2_N) return null;
    const header = sealed.subarray(0, 2);
    const salt = sealed.subarray(2, 2 + SALT_BYTES);
    const iv = sealed.subarray(2 + SALT_BYTES, HEADER_BYTES);
    const tag = sealed.subarray(HEADER_BYTES, HEADER_BYTES + TAG_BYTES);
    const encrypted = sealed.subarray(HEADER_BYTES + TAG_BYTES);
    try {
      const key = await deriveKey(email, password, salt, log2N);
      return gcm(key, iv, header).decrypt(concatBytes(encrypted, tag));
    } catch {
      return null;
    }
  }
}
