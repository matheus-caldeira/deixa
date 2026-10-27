import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "deixa1234";
const ENGLISH = "fixtures/sample.en.srt";
const SCRIPT = "fixtures/sample.en.txt";

async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(`${name.toLowerCase()}@deixa.example`);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: `Perfil de ${name}` })).toBeVisible();
}

async function openAddSheet(page: Page) {
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Adicionar, importar ou exportar" }).first().click();
  await page
    .getByRole("dialog", { name: "Catálogo" })
    .getByRole("button", { name: /^Adicionar/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Adicionar ao catálogo" });
  await sheet.getByLabel("Nome da série ou filme").fill("suits");
  await sheet.getByRole("button", { name: /Suits/ }).click();
  await sheet.getByRole("button", { name: "Continuar" }).click();
  await expect(sheet.getByRole("heading", { name: "Suits" })).toBeVisible();
  await expect(sheet.getByLabel("Episódio")).not.toContainText("Carregando");
  return sheet;
}

test("roteiro .txt conferido contra a legenda e falas completadas na leitura", async ({ page }) => {
  await signIn(page, "Lucas");
  let sheet = await openAddSheet(page);
  const labels = await sheet.getByLabel("Episódio").locator("option").allTextContents();
  const free = labels.findIndex((label) => label.includes("(sem legenda)"));
  expect(free).toBeGreaterThanOrEqual(0);
  const episodeTitle = labels[free]?.replace(/ \(sem legenda\)$/, "").replace(/^E\d+ · /, "") ?? "";
  await sheet.getByLabel("Episódio").selectOption({ index: free });
  await sheet.getByRole("button", { name: "Enviar arquivos .srt manualmente" }).click();
  await sheet.getByLabel("Arquivo da legenda em inglês").setInputFiles(ENGLISH);
  await sheet.getByLabel("Arquivo de roteiro").setInputFiles(SCRIPT);
  await sheet.getByRole("button", { name: "Enviar e processar" }).click();
  await expect(sheet.getByText("Conferindo o roteiro contra a legenda")).toBeVisible();
  await expect(sheet.getByText("23 de 23 falas · 100%")).toBeVisible();
  await expect(sheet.getByText("conferido", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Suits" })).toBeVisible();

  await page.getByRole("link", { name: `Ler e marcar a legenda: ${episodeTitle}` }).click();
  await expect(page).toHaveURL(/\/read\?id=/);
  await expect(page.getByText("Roteiro conferido: 23 de 23 falas batem")).toBeVisible();
  const completions = page.getByTestId("script-line");
  await expect(completions).toHaveCount(2);
  await expect(completions.first()).toContainText("to be honest");

  sheet = await openAddSheet(page);
  await sheet
    .getByLabel("Episódio")
    .selectOption({ label: labels[free]?.replace("(sem legenda)", "(pronto)") ?? "" });
  await sheet.getByRole("button", { name: "Enviar arquivos .srt manualmente" }).click();
  await sheet.getByLabel("Arquivo de roteiro").setInputFiles(SCRIPT);
  await sheet.getByRole("button", { name: "Enviar e processar" }).click();
  await expect(sheet.getByText("roteiro idêntico encontrado")).toBeVisible();
});
