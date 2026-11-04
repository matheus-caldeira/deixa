import { defineConfig } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_FIRST_ACCOUNT_BASE_URL,
  E2E_FIRST_ACCOUNT_PORT,
  E2E_PORT,
  E2E_SETUP_BASE_URL,
  E2E_SETUP_PORT,
  e2eEnvironment,
  e2eFirstAccountEnvironment,
  e2eSetupEnvironment,
} from "./tests/e2e/environment";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    channel: "chrome",
    headless: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `pnpm exec next start -H 127.0.0.1 -p ${E2E_PORT}`,
      url: `${E2E_BASE_URL}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...e2eEnvironment(), NODE_ENV: "production" },
    },
    {
      command: `pnpm exec next start -H 127.0.0.1 -p ${E2E_SETUP_PORT}`,
      url: `${E2E_SETUP_BASE_URL}/setup`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...e2eSetupEnvironment(), NODE_ENV: "production" },
    },
    {
      command: `pnpm exec next start -H 127.0.0.1 -p ${E2E_FIRST_ACCOUNT_PORT}`,
      url: `${E2E_FIRST_ACCOUNT_BASE_URL}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...e2eFirstAccountEnvironment(), NODE_ENV: "production" },
    },
  ],
});
