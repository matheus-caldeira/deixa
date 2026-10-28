import { expect, test } from "@playwright/test";

test("privacidade e direitos abre sem login e pelo menu Mais", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacidade e direitos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sua voz" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Legendas e roteiros" })).toBeVisible();
});
