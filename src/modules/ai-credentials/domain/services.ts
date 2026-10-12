export const CREDENTIAL_SERVICES = ["gemini", "tmdb", "opensubtitles"] as const;
export type CredentialService = (typeof CREDENTIAL_SERVICES)[number];
export type TmdbSecretKind = "readAccessToken" | "apiKey";

const GEMINI_KEY = /^AIza[\w-]{20,}$/;
const TMDB_TOKEN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const TMDB_KEY = /^[0-9a-f]{32}$/i;
const OPENSUBTITLES_KEY = /^[A-Za-z0-9]{20,64}$/;

export const SERVICE_LABELS: Record<CredentialService, string> = {
  gemini: "Google AI (Gemini)",
  tmdb: "TMDB",
  opensubtitles: "OpenSubtitles",
};

const SHAPE_HINTS: Record<CredentialService, string> = {
  gemini: 'Chaves do Google AI Studio começam com "AIza" e têm 39 caracteres.',
  tmdb: 'Use o token de leitura da API (começa com "eyJ") ou a chave de API de 32 caracteres.',
  opensubtitles: "A chave de API do OpenSubtitles tem só letras e números, sem espaços.",
};

export function isCredentialService(value: unknown): value is CredentialService {
  return typeof value === "string" && (CREDENTIAL_SERVICES as readonly string[]).includes(value);
}

export function tmdbSecretKind(secret: string): TmdbSecretKind | null {
  if (TMDB_TOKEN.test(secret)) return "readAccessToken";
  return TMDB_KEY.test(secret) ? "apiKey" : null;
}

export function looksLikeSecret(service: CredentialService, secret: string): boolean {
  if (service === "gemini") return GEMINI_KEY.test(secret);
  if (service === "tmdb") return tmdbSecretKind(secret) !== null;
  return OPENSUBTITLES_KEY.test(secret);
}

export function shapeHint(service: CredentialService): string {
  return SHAPE_HINTS[service];
}
