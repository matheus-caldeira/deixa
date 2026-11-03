const MAX_PATH_CHARS = 2048;
const BASE = "http://deixa.invalid";
const UNSAFE_CHARACTERS = /[\\\s\u0000-\u001f\u007f]/;

export function internalPath(candidate: unknown): string | null {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > MAX_PATH_CHARS) return null;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || UNSAFE_CHARACTERS.test(candidate)) return null;
  try {
    const parsed = new URL(candidate, BASE);
    if (parsed.origin !== BASE || parsed.pathname.startsWith("//")) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
