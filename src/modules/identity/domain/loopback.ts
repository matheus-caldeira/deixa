const IPV4_LOOPBACK = /^127(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_LOOPBACK = new Set(["::1", "0:0:0:0:0:0:0:1"]);
const IPV4_MAPPED_PREFIX = "::ffff:";

export function isLoopbackAddress(address: string): boolean {
  const value = address
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1");
  if (IPV6_LOOPBACK.has(value)) return true;
  const ipv4 = value.startsWith(IPV4_MAPPED_PREFIX) ? value.slice(IPV4_MAPPED_PREFIX.length) : value;
  return IPV4_LOOPBACK.test(ipv4);
}

export function isLoopbackForwardedFor(header: string | null | undefined): boolean {
  if (!header) return false;
  const hops = header.split(",");
  const [only] = hops;
  return hops.length === 1 && only !== undefined && isLoopbackAddress(only);
}

const LOOPBACK_HOST_NAME = "localhost";
const HOST_WITH_PORT = /^(\[[^\]]+\]|[^:]+)(:\d+)?$/;

export function isLoopbackHost(header: string | null | undefined): boolean {
  if (!header) return false;
  const match = HOST_WITH_PORT.exec(header.trim().toLowerCase());
  const name = match?.[1];
  if (!name) return false;
  return name === LOOPBACK_HOST_NAME || isLoopbackAddress(name);
}

export function isLoopbackRequest(headers: {
  forwardedFor: string | null | undefined;
  host: string | null | undefined;
}): boolean {
  return isLoopbackForwardedFor(headers.forwardedFor) && isLoopbackHost(headers.host);
}
