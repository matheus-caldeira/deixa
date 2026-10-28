import { expect, test } from "@playwright/test";

test("cria conta e abre o início no modo pessoal, sem servidor", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/signup/", { waitUntil: "networkidle" });
  await page.locator("#signup-name").fill("Bia");
  await page.locator("#signup-email").fill("bia@deixa.local");
  await page.locator("#signup-password").fill("segredo123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:1320/", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Perfil de Bia" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Escolha um episódio" })).toBeVisible();
  await page.screenshot({ path: "test-results/web-home.png" });
  expect(errors).toEqual([]);
});
