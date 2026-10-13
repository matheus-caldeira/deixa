import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { configDirectory, readDesktopToken } from "../config/local-config";

const MIN_TOKEN_CHARS = 40;
const NONCE_SHAPE = /^[0-9a-f]{32,64}$/;
const PROOF_PREFIX = "hello:";
const TICKET_BYTES = 32;
const TICKET_TTL_MS = 30_000;
const MAX_OPEN_TICKETS = 20;

const tickets = new Map<string, number>();

function currentToken(): string | null {
  const token = readDesktopToken(configDirectory());
  return token && token.length >= MIN_TOKEN_CHARS ? token : null;
}

export function isDesktopToken(candidate: string | null | undefined): boolean {
  const expected = currentToken();
  if (!expected || !candidate) return false;
  const given = Buffer.from(candidate);
  const known = Buffer.from(expected);
  return given.length === known.length && timingSafeEqual(given, known);
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
