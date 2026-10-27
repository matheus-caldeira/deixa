import { scryptAsync } from "@noble/hashes/scrypt.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { base64ToBytes, bytesToBase64, bytesToBase64Url } from "@/shared/base64";
import { sha256Hex } from "@/shared/hash";
import type { PasswordHasher, SessionTokens } from "../application/ports";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const TOKEN_BYTES = 32;
const SCHEME = "scrypt";
const SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 1 };
const DECOY_SALT = new Uint8Array(SALT_BYTES).fill(1);

function derive(plain: string, salt: Uint8Array, length: number): Promise<Uint8Array> {
  return scryptAsync(plain, salt, { ...SCRYPT_PARAMS, dkLen: length });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

export const portablePasswords: PasswordHasher = {
  async hash(plain) {
    const salt = randomBytes(SALT_BYTES);
    const derived = await derive(plain, salt, KEY_BYTES);
    return `${SCHEME}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
  },
  async verify(plain, stored) {
    if (stored === null) {
      await derive(plain, DECOY_SALT, KEY_BYTES);
      return false;
    }
    const [scheme, saltText, hashText] = stored.split("$");
    if (scheme !== SCHEME || !saltText || !hashText) return false;
    const expected = base64ToBytes(hashText);
    return sameBytes(await derive(plain, base64ToBytes(saltText), expected.length), expected);
  },
};

export const portableSessionTokens: SessionTokens = {
  issue() {
    const token = bytesToBase64Url(randomBytes(TOKEN_BYTES));
    return { token, tokenHash: sha256Hex(token) };
  },
  hash: sha256Hex,
};
