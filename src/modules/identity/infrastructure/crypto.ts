import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PasswordHasher, SessionTokens } from "../application/ports";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const TOKEN_BYTES = 32;
const SCHEME = "scrypt";

export const scryptPasswords: PasswordHasher = {
  async hash(plain) {
    const salt = randomBytes(SALT_BYTES);
    const derived = await scryptAsync(plain, salt, KEY_BYTES);
    return `${SCHEME}$${salt.toString("base64")}$${derived.toString("base64")}`;
  },
  async verify(plain, stored) {
    const [scheme, saltText, hashText] = stored.split("$");
    if (scheme !== SCHEME || !saltText || !hashText) return false;
    const expected = Buffer.from(hashText, "base64");
    const derived = await scryptAsync(plain, Buffer.from(saltText, "base64"), expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  },
};

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const randomSessionTokens: SessionTokens = {
  issue() {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    return { token, tokenHash: hashToken(token) };
  },
  hash: hashToken,
};
