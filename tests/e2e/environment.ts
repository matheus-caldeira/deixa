import { existsSync } from "node:fs";

export const E2E_PORT = 1310;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_DATA_DIR = "data/e2e";
export const E2E_SETUP_PORT = 1311;
export const E2E_SETUP_BASE_URL = `http://127.0.0.1:${E2E_SETUP_PORT}`;
export const E2E_SETUP_CONFIG_DIR = "data/e2e-setup";
export const E2E_FIRST_ACCOUNT_PORT = 1312;
export const E2E_FIRST_ACCOUNT_BASE_URL = `http://127.0.0.1:${E2E_FIRST_ACCOUNT_PORT}`;
export const E2E_FIRST_ACCOUNT_CONFIG_DIR = "data/e2e-first-account";
const E2E_SETUP_DATABASE = "deixa_e2e_setup";
const E2E_FIRST_ACCOUNT_DATABASE = "deixa_e2e_first_account";
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

export function e2eSetupEnvironment(): Record<string, string> {
  return { ...e2eEnvironment(), DATABASE_URL: "", DEIXA_CONFIG_DIR: E2E_SETUP_CONFIG_DIR };
}

export function e2eFirstAccountEnvironment(): Record<string, string> {
  const variables = e2eEnvironment();
  const url = new URL(variables.DATABASE_URL ?? "");
  url.pathname = `/${E2E_FIRST_ACCOUNT_DATABASE}`;
  return { ...variables, DATABASE_URL: url.toString(), DEIXA_CONFIG_DIR: E2E_FIRST_ACCOUNT_CONFIG_DIR };
}

export function e2eSetupTarget(): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const url = new URL(e2eEnvironment().DATABASE_URL ?? "");
  return {
    host: url.hostname,
    port: url.port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: E2E_SETUP_DATABASE,
  };
}
