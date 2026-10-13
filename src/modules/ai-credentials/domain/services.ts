import { canonicalServiceUrl } from "@/shared/service-url";

export const AI_SERVICES = [
  "gemini",
  "openai",
  "anthropic",
  "openrouter",
  "ollama",
  "openai_compatible",
] as const;
export const CATALOG_SERVICES = ["tmdb", "opensubtitles"] as const;
export const CREDENTIAL_SERVICES = [...AI_SERVICES, ...CATALOG_SERVICES] as const;
export type CredentialService = (typeof CREDENTIAL_SERVICES)[number];
export type AiService = (typeof AI_SERVICES)[number];
export type TmdbSecretKind = "readAccessToken" | "apiKey";
export type SecretKind = "key" | "endpoint";

const GEMINI_KEY = /^AIza[\w-]{20,}$/;
const OPENAI_KEY = /^sk-[\w-]{20,}$/;
const ANTHROPIC_KEY = /^sk-ant-[\w-]{20,}$/;
const OPENROUTER_KEY = /^sk-or-[\w-]{20,}$/;
const TMDB_TOKEN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const TMDB_KEY = /^[0-9a-f]{32}$/i;
const OPENSUBTITLES_KEY = /^[A-Za-z0-9]{20,64}$/;
const MAX_ENDPOINT_KEY_CHARS = 500;

export const SERVICE_LABELS: Record<CredentialService, string> = {
  gemini: "Google AI (Gemini)",
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  openai_compatible: "Compatível com OpenAI",
  tmdb: "TMDB",
  opensubtitles: "OpenSubtitles",
};

const SHAPE_HINTS: Record<CredentialService, string> = {
  gemini: 'Chaves do Google AI Studio começam com "AIza" e têm 39 caracteres.',
  openai: 'Chaves da OpenAI começam com "sk-".',
  anthropic: 'Chaves da Anthropic começam com "sk-ant-".',
  openrouter: 'Chaves do OpenRouter começam com "sk-or-".',
  ollama: "Informe o endereço do Ollama, como http://localhost:11434.",
  openai_compatible: "Informe o endereço do servidor, terminando em /v1, e a chave se ele pedir.",
  tmdb: 'Use o token de leitura da API (começa com "eyJ") ou a chave de API de 32 caracteres.',
  opensubtitles: "A chave de API do OpenSubtitles tem só letras e números, sem espaços.",
};

export const SECRET_KINDS: Record<CredentialService, SecretKind> = {
  gemini: "key",
  openai: "key",
  anthropic: "key",
  openrouter: "key",
  ollama: "endpoint",
  openai_compatible: "endpoint",
  tmdb: "key",
  opensubtitles: "key",
};

export const PROVIDERS_WITH_EMBEDDINGS: ReadonlySet<AiService> = new Set<AiService>([
  "gemini",
  "openai",
  "openrouter",
  "ollama",
  "openai_compatible",
]);

export type Endpoint = { baseUrl: string; apiKey: string | null };

export function isCredentialService(value: unknown): value is CredentialService {
  return typeof value === "string" && (CREDENTIAL_SERVICES as readonly string[]).includes(value);
}

export function isAiService(value: unknown): value is AiService {
  return typeof value === "string" && (AI_SERVICES as readonly string[]).includes(value);
}

export function tmdbSecretKind(secret: string): TmdbSecretKind | null {
  if (TMDB_TOKEN.test(secret)) return "readAccessToken";
  return TMDB_KEY.test(secret) ? "apiKey" : null;
}

export function endpointSecret(endpoint: Endpoint): string {
  return JSON.stringify({ baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey });
}

export function parseEndpoint(secret: string): Endpoint | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(secret);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { baseUrl, apiKey } = parsed as { baseUrl?: unknown; apiKey?: unknown };
  if (typeof baseUrl !== "string") return null;
  const canonical = canonicalServiceUrl(baseUrl);
  if (!canonical) return null;
  if (apiKey !== null && apiKey !== undefined && typeof apiKey !== "string") return null;
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (key.length > MAX_ENDPOINT_KEY_CHARS || /\s/.test(key)) return null;
  return { baseUrl: canonical, apiKey: key === "" ? null : key };
}

export function looksLikeSecret(service: CredentialService, secret: string): boolean {
  switch (service) {
    case "gemini":
      return GEMINI_KEY.test(secret);
    case "openai":
      return OPENAI_KEY.test(secret) && !ANTHROPIC_KEY.test(secret) && !OPENROUTER_KEY.test(secret);
    case "anthropic":
      return ANTHROPIC_KEY.test(secret);
    case "openrouter":
      return OPENROUTER_KEY.test(secret);
    case "ollama":
    case "openai_compatible":
      return parseEndpoint(secret) !== null;
    case "tmdb":
      return tmdbSecretKind(secret) !== null;
    case "opensubtitles":
      return OPENSUBTITLES_KEY.test(secret);
  }
}

export function shapeHint(service: CredentialService): string {
  return SHAPE_HINTS[service];
}
