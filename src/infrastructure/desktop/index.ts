import { timingSafeEqual } from "node:crypto";
import { configDirectory, readDesktopToken } from "../config/local-config";

const MIN_TOKEN_CHARS = 40;

export function isDesktopToken(candidate: string | null | undefined): boolean {
  const expected = readDesktopToken(configDirectory());
  if (!expected || expected.length < MIN_TOKEN_CHARS || !candidate) return false;
  const given = Buffer.from(candidate);
  const known = Buffer.from(expected);
  return given.length === known.length && timingSafeEqual(given, known);
}
