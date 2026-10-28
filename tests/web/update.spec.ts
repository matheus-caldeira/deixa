import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const WORKER = ".next-web/sw.js";

test("versão nova do app aparece como aviso e atualiza ao tocar", async ({ page }) => {
  const original = readFileSync(WORKER, "utf8");
  try {
    await page.goto("/login/", { waitUntil: "networkidle" });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    writeFileSync(WORKER, original.replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-next"'));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText("Versão nova do app pronta.")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Atualizar" }).click();
    await expect
      .poll(() =>
        page
          .evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type)
          .catch(() => "navigating"),
      )
      .toBe("reload");
    await expect(page.getByText("Versão nova do app pronta.")).toHaveCount(0);
  } finally {
    writeFileSync(WORKER, original);
  }
});
