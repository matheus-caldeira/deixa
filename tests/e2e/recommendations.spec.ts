import { expect, test } from "@playwright/test";

const PASSWORD = "deixa1234";
const LABEL_PREFIX = "Sugestão: ";

test("Explorar → Para você → recusar uma sugestão → adicionar outra ao catálogo", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("ana@deixa.example");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Perfil de Ana" })).toBeVisible();

  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Explorar" }).click();
  const section = page.getByRole("region", { name: "Sugestões para você" });
  await expect(section.getByRole("heading", { name: "Para você" })).toBeVisible();
  const cards = section.getByRole("button", { name: new RegExp(`^${LABEL_PREFIX}`) });
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  await expect(section.getByText(/Escolhidas por semelhança com o que você estudou/)).toBeVisible();
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);

  const refusedTitle = ((await cards.first().getAttribute("aria-label")) ?? "").replace(LABEL_PREFIX, "");
  await cards.first().click();
  const sheet = page.getByRole("dialog", { name: "Sugestão para você" });
  await expect(sheet.getByRole("heading", { name: refusedTitle })).toBeVisible();
  await expect(sheet.getByText("Por que para você.")).toBeVisible();
  await sheet.getByRole("button", { name: "Não tenho interesse" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(cards).toHaveCount(before - 1);
  await expect(section.getByRole("button", { name: `${LABEL_PREFIX}${refusedTitle}` })).toHaveCount(0);

  const addedTitle = ((await cards.first().getAttribute("aria-label")) ?? "").replace(LABEL_PREFIX, "");
  await cards.first().click();
  await sheet.getByRole("button", { name: "Adicionar ao catálogo" }).click();
  await expect(page).toHaveURL(/\/catalog\/work\?id=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: addedTitle })).toBeVisible();

  await page.getByRole("link", { name: "Explorar" }).first().click();
  await expect(section.getByRole("heading", { name: "Para você" })).toBeVisible();
  await expect(section.getByRole("button", { name: `${LABEL_PREFIX}${addedTitle}` })).toHaveCount(0);
  await expect(section.getByRole("button", { name: `${LABEL_PREFIX}${refusedTitle}` })).toHaveCount(0);
});
