import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_IPV4 = /^(0\.|169\.254\.)/;
const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const LINK_LOCAL_IPV6 = /^fe[89ab][0-9a-f]:/i;
const UNSPECIFIED_IPV6 = "::";

export type AddressResolver = (hostname: string) => Promise<string[]>;

const systemResolver: AddressResolver = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address);

export function isBlockedAddress(address: string): boolean {
  const mapped = MAPPED_IPV4.exec(address)?.[1];
  if (mapped) return BLOCKED_IPV4.test(mapped);
  if (isIP(address) === 4) return BLOCKED_IPV4.test(address);
  return address === UNSPECIFIED_IPV6 || LINK_LOCAL_IPV6.test(address);
}

export async function resolvesToAllowedAddress(
  baseUrl: string,
  resolve: AddressResolver = systemResolver,
): Promise<boolean> {
  const hostname = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) === 0 ? await resolve(hostname) : [hostname];
  return addresses.length > 0 && !addresses.some(isBlockedAddress);
}
