import { defineConfig } from "@playwright/test";
import { DESKTOP_BASE_URL, packagedServerCommand } from "./tests/desktop/environment";

export default defineConfig({
  testDir: "tests/desktop",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [["list"]],
  use: {
    baseURL: DESKTOP_BASE_URL,
    channel: "chrome",
    headless: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: packagedServerCommand(),
    url: `${DESKTOP_BASE_URL}/setup`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
