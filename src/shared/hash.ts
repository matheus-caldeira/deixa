import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export function sha256Hex(input: Uint8Array | string): string {
  return bytesToHex(sha256(typeof input === "string" ? utf8ToBytes(input) : input));
}
