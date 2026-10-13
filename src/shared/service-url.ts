const BLOCKED_IPV4 = /^(0\.|169\.254\.)/;
const BLOCKED_NAMES = new Set(["metadata.google.internal", "metadata"]);
const LOOPBACK_IPV6 = "[::1]";

export function canonicalServiceUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") return null;
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  const isIpv6 = host.startsWith("[");
  if (host === "" || BLOCKED_IPV4.test(host) || BLOCKED_NAMES.has(host)) return null;
  if (isIpv6 && host !== LOOPBACK_IPV6) return null;
  const path = url.pathname.replace(/\/+$/, "");
  const port = url.port === "" ? "" : `:${url.port}`;
  return `${url.protocol}//${host}${port}${path}`;
}
