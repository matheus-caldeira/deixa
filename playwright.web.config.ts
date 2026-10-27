import { defineConfig } from "@playwright/test";

const PORT = 1320;

export default defineConfig({
  testDir: "tests/web",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    headless: true,
    locale: "pt-BR",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `PORT=${PORT} node scripts/serve-web.mjs`,
    url: `http://127.0.0.1:${PORT}/lab/`,
    reuseExistingServer: false,
  },
});
