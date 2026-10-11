import { existsSync } from "node:fs";

export const E2E_PORT = 1310;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_DATA_DIR = "data/e2e";
const E2E_DATABASE = "deixa_e2e";

export function e2eEnvironment(): Record<string, string> {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const base = process.env.DATABASE_URL;
  const masterKey = process.env.AI_CREDENTIALS_MASTER_KEY;
  if (!base || !masterKey) throw new Error("Rode pnpm setup:env antes do e2e.");
  const url = new URL(base);
  url.pathname = `/${E2E_DATABASE}`;
  return {
    DATABASE_URL: url.toString(),
    AI_CREDENTIALS_MASTER_KEY: masterKey,
    DATA_DIR: E2E_DATA_DIR,
    TMDB_API_KEY: "",
    TMDB_READ_ACCESS_TOKEN: "",
    KOKORO_URL: "",
    DEV_SHORTCUTS: "true",
    SESSION_COOKIE_SECURE: "false",
    GEMINI_MODEL: "",
    GEMINI_API_KEY: "",
    OPENSUBTITLES_API_KEY: "",
    OPENSUBTITLES_USERNAME: "",
    OPENSUBTITLES_PASSWORD: "",
  };
}
