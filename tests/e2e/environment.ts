import { existsSync } from "node:fs";

export const E2E_PORT = 1310;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_DATA_DIR = "data/e2e";
const E2E_DATABASE = "deixa_e2e";
const E2E_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

export function e2eEnvironment(): Record<string, string> {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Rode pnpm setup:env antes do e2e.");
  const url = new URL(base);
  url.pathname = `/${E2E_DATABASE}`;
  return {
    DATABASE_URL: url.toString(),
    AI_CREDENTIALS_MASTER_KEY: E2E_MASTER_KEY,
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
    SUBTITLE_DOWNLOADS_PER_USER_PER_DAY: "",
  };
}
