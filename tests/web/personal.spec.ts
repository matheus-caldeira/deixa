import { expect, test, type Page } from "@playwright/test";

const ENGLISH = "fixtures/sample.en.srt";
const PORTUGUESE = "fixtures/sample.pt-BR.srt";

async function signUp(page: Page) {
  await page.goto("/signup/", { waitUntil: "networkidle" });
  await page.locator("#signup-name").fill("Bia");
  await page.locator("#signup-email").fill("bia@deixa.local");
  await page.locator("#signup-password").fill("segredo123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Perfil de Bia" })).toBeVisible({ timeout: 30_000 });
}

test("modo pessoal sem servidor: conta, obra, legenda, leitura e marcação, e de novo sem rede", async ({
  context,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signUp(page);
  await expect(page.getByRole("heading", { name: "Escolha um episódio" })).toBeVisible();

  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Explorar" }).click();
  await page.getByRole("button", { name: "Adicionar, importar ou exportar" }).first().click();
  await page
    .getByRole("dialog", { name: "Catálogo" })
    .getByRole("button", { name: /^Adicionar/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Adicionar ao catálogo" });
  await sheet.getByLabel("Nome da série ou filme").fill("modern");
  await sheet.getByRole("button", { name: /Modern Family/ }).click();
  await sheet.getByRole("button", { name: "Continuar" }).click();
  await expect(sheet.getByLabel("Episódio")).toContainText("E01 · Pilot", { timeout: 30_000 });
  await sheet.getByRole("button", { name: "Enviar arquivos .srt manualmente" }).click();
  await sheet.getByLabel("Arquivo da legenda em inglês").setInputFiles(ENGLISH);
  await sheet.getByLabel("Arquivo da legenda em português").setInputFiles(PORTUGUESE);
  await sheet.getByRole("button", { name: "Enviar e processar" }).click();
  await expect(sheet.getByText("22 pares · 96%")).toBeVisible({ timeout: 60_000 });
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Modern Family" })).toBeVisible();

  await page.getByRole("link", { name: "Ler e marcar a legenda: Pilot" }).click();
  await expect(page).toHaveURL(/\/read\/?\?id=/);
  const lines = page.getByTestId("line");
  await expect(lines).toHaveCount(23, { timeout: 30_000 });
  const billLine = lines.filter({ hasText: "split the bill" });
  for (const word of ["split", "the", "bill?"]) {
    await billLine.getByRole("button", { name: word, exact: true }).click();
  }
  await expect(page.getByTestId("mark-count")).toHaveText("1");
  const readUrl = page.url();
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: "test-results/web-read.png" });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto(readUrl);
  await expect(lines).toHaveCount(23, { timeout: 30_000 });
  await expect(page.getByTestId("mark-count")).toHaveText("1");
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
