const GOOGLE_KEY_SHAPE = /^AIza[\w-]{20,}$/;
const VISIBLE_EDGE = 4;
const MASK = "••••••••";

export function looksLikeGoogleApiKey(value: string): boolean {
  return GOOGLE_KEY_SHAPE.test(value.trim());
}

export function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= VISIBLE_EDGE * 2) return MASK;
  return `${trimmed.slice(0, VISIBLE_EDGE)}${MASK}${trimmed.slice(-VISIBLE_EDGE)}`;
}
