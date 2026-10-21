import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { LevelFetchResult, LevelSourceFetcher } from "../application/level-sources";
import { MAX_LEVEL_SOURCE_BYTES, isLevelSourceUrl } from "../domain/level-ratings";

const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const FIRST_REDIRECT = 300;
const LAST_REDIRECT = 399;
const OK_MIN = 200;
const OK_MAX = 299;

const IPV4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const IPV6_BLOCKED: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

const blocked = new BlockList();
for (const [address, prefix] of IPV4_BLOCKED) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of IPV6_BLOCKED) blocked.addSubnet(address, prefix, "ipv6");

const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function isPublicAddress(address: string): boolean {
  const mapped = MAPPED_IPV4.exec(address)?.[1];
  if (mapped) return isPublicAddress(mapped);
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

class BlockedAddressError extends Error {
  readonly code = "EBLOCKED";
}

type Outcome =
  { kind: "response"; response: IncomingMessage } | { kind: "failure"; result: LevelFetchResult };

export class HttpLevelSourceFetcher implements LevelSourceFetcher {
  constructor(private readonly options: { allowPrivateNetwork: boolean } = { allowPrivateNetwork: false }) {}

  private readonly safeLookup: LookupFunction = (hostname, options, callback) => {
    dnsLookup(hostname, { all: true, family: options.family ?? 0 }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, "", 0);
      const allowed = this.options.allowPrivateNetwork
        ? addresses
        : addresses.filter((entry) => isPublicAddress(entry.address));
      if (allowed.length === 0 || allowed.length !== addresses.length) {
        return callback(new BlockedAddressError(hostname), "", 0);
      }
      if (options.all) return callback(null, allowed);
      const [first] = allowed;
      return first
        ? callback(null, first.address, first.family)
        : callback(new BlockedAddressError(hostname), "", 0);
    });
  };

  private open(url: URL, signal: AbortSignal): Promise<Outcome> {
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) !== 0 && !this.options.allowPrivateNetwork && !isPublicAddress(literal)) {
      return Promise.resolve({ kind: "failure", result: { ok: false, reason: "blocked", status: null } });
    }
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    return new Promise((resolve) => {
      const outgoing = request(url, {
        method: "GET",
        headers: { accept: "application/json" },
        lookup: this.safeLookup,
        signal,
      });
      outgoing.on("response", (response) => resolve({ kind: "response", response }));
      outgoing.on("error", (error) => {
        const reason =
          error instanceof BlockedAddressError
            ? "blocked"
            : error.name === "AbortError" || error.name === "TimeoutError"
              ? "timeout"
              : "unreachable";
        resolve({ kind: "failure", result: { ok: false, reason, status: null } });
      });
      outgoing.end();
    });
  }

  async fetchJson(url: string): Promise<LevelFetchResult> {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!isLevelSourceUrl(current)) return { ok: false, reason: "blocked", status: null };
      const outcome = await this.open(new URL(current), signal);
      if (outcome.kind === "failure") return outcome.result;
      const { response } = outcome;
      const status = response.statusCode ?? 0;
      if (status >= FIRST_REDIRECT && status <= LAST_REDIRECT && response.headers.location) {
        response.resume();
        current = new URL(response.headers.location, current).toString();
        continue;
      }
      if (status < OK_MIN || status > OK_MAX) {
        response.resume();
        return { ok: false, reason: "status", status };
      }
      if (Number(response.headers["content-length"] ?? 0) > MAX_LEVEL_SOURCE_BYTES) {
        response.destroy();
        return { ok: false, reason: "tooLarge", status: null };
      }
      return this.readJson(response);
    }
    return { ok: false, reason: "unreachable", status: null };
  }

  private async readJson(response: IncomingMessage): Promise<LevelFetchResult> {
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of response) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        size += buffer.byteLength;
        if (size > MAX_LEVEL_SOURCE_BYTES) {
          response.destroy();
          return { ok: false, reason: "tooLarge", status: null };
        }
        chunks.push(buffer);
      }
    } catch {
      return { ok: false, reason: "timeout", status: null };
    }
    try {
      return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
    } catch {
      return { ok: false, reason: "notJson", status: null };
    }
  }
}
