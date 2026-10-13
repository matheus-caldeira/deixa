import { SECRET_KINDS, parseEndpoint, type CredentialService } from "./services";

const GOOGLE_KEY_SHAPE = /^AIza[\w-]{20,}$/;
const VISIBLE_EDGE = 4;
const MASK = "••••••••";

export function looksLikeGoogleApiKey(value: string): boolean {
  return GOOGLE_KEY_SHAPE.test(value.trim());
}

export function maskSecret(service: CredentialService, value: string): string {
  if (SECRET_KINDS[service] !== "endpoint") return maskApiKey(value);
  const endpoint = parseEndpoint(value);
  if (!endpoint) return MASK;
  return endpoint.apiKey ? `${endpoint.baseUrl} · chave ${MASK}` : endpoint.baseUrl;
}

export function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= VISIBLE_EDGE * 2) return MASK;
  return `${trimmed.slice(0, VISIBLE_EDGE)}${MASK}${trimmed.slice(-VISIBLE_EDGE)}`;
}
