import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAPPED_DOTTED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const MAPPED_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const BYTE = 256;

const allowed = new BlockList();
allowed.addSubnet("127.0.0.0", 8, "ipv4");
allowed.addSubnet("10.0.0.0", 8, "ipv4");
allowed.addSubnet("172.16.0.0", 12, "ipv4");
allowed.addSubnet("192.168.0.0", 16, "ipv4");
allowed.addSubnet("100.64.0.0", 10, "ipv4");
allowed.addAddress("::1", "ipv6");
allowed.addSubnet("fc00::", 7, "ipv6");

const refused = new BlockList();
refused.addAddress("100.100.100.200", "ipv4");
refused.addSubnet("fd00:ec2::", 32, "ipv6");

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type AddressResolver = (hostname: string) => Promise<string[]>;

const systemResolver: AddressResolver = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address);

function unwrapMapped(address: string): string {
  const dotted = MAPPED_DOTTED.exec(address)?.[1];
  if (dotted) return dotted;
  const hex = MAPPED_HEX.exec(address);
  if (!hex) return address;
  const high = Number.parseInt(hex[1] ?? "0", 16);
  const low = Number.parseInt(hex[2] ?? "0", 16);
  return [Math.floor(high / BYTE), high % BYTE, Math.floor(low / BYTE), low % BYTE].join(".");
}

export function isAllowedAddress(candidate: string): boolean {
  const address = unwrapMapped(candidate.toLowerCase());
  const version = isIP(address);
  if (version === 0) return false;
  const family = version === 4 ? "ipv4" : "ipv6";
  return allowed.check(address, family) && !refused.check(address, family);
}

export async function resolveAllowedAddresses(
  baseUrl: string,
  resolve: AddressResolver = systemResolver,
): Promise<ResolvedAddress[]> {
  const hostname = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) === 0 ? await resolve(hostname) : [hostname];
  if (!addresses.every(isAllowedAddress)) return [];
  return addresses.map((candidate) => {
    const address = unwrapMapped(candidate.toLowerCase());
    return { address, family: isIP(address) === 4 ? 4 : 6 };
  });
}
