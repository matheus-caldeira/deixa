import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { configDirectory, readDesktopToken } from "../config/local-config";

const MIN_TOKEN_CHARS = 40;
const NONCE_SHAPE = /^[0-9a-f]{32,64}$/;
const STAMP_SHAPE = /^\d{9,12}$/;
const PROOF_SHAPE = /^[0-9a-f]{64}$/;
const MS_PER_SECOND = 1000;
const MAX_CLOCK_SKEW_MS = 60_000;
const PROOF_PREFIX = "hello:";
const TICKET_BYTES = 32;
const TICKET_TTL_MS = 30_000;
const MAX_OPEN_TICKETS = 20;

const tickets = new Map<string, number>();

function currentToken(): string | null {
  const token = readDesktopToken(configDirectory());
  return token && token.length >= MIN_TOKEN_CHARS ? token : null;
}

export function verifyDesktopRequest(
  request: { method: string; path: string; signature: string | null | undefined },
  now: number = Date.now(),
): boolean {
  const token = currentToken();
  const [stamp, proof] = (request.signature ?? "").split(".");
  if (!token || !stamp || !proof || !STAMP_SHAPE.test(stamp) || !PROOF_SHAPE.test(proof)) return false;
  if (Math.abs(now - Number(stamp) * MS_PER_SECOND) > MAX_CLOCK_SKEW_MS) return false;
  const expected = createHmac("sha256", token)
    .update(`${request.method}\n${request.path}\n${stamp}`)
    .digest();
  const given = Buffer.from(proof, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function proveDesktopPeer(nonce: string | null | undefined): string | null {
  const token = currentToken();
  if (!token || !nonce || !NONCE_SHAPE.test(nonce)) return null;
  return createHmac("sha256", token).update(`${PROOF_PREFIX}${nonce}`).digest("hex");
}

function dropExpired(now: number): void {
  for (const [ticket, expiresAt] of tickets) {
    if (expiresAt <= now) tickets.delete(ticket);
  }
}

export function issueEntryTicket(now: number = Date.now()): string {
  dropExpired(now);
  while (tickets.size >= MAX_OPEN_TICKETS) {
    const oldest = tickets.keys().next().value;
    if (oldest === undefined) break;
    tickets.delete(oldest);
  }
  const ticket = randomBytes(TICKET_BYTES).toString("hex");
  tickets.set(ticket, now + TICKET_TTL_MS);
  return ticket;
}

export function redeemEntryTicket(candidate: string | null | undefined, now: number = Date.now()): boolean {
  if (!candidate) return false;
  const expiresAt = tickets.get(candidate);
  tickets.delete(candidate);
  return expiresAt !== undefined && expiresAt > now;
}
