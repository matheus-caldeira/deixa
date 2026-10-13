import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "deixa1234";
const AI_SERVICES = ["Google AI (Gemini)"];
const CATALOG_SERVICES = ["TMDB", "OpenSubtitles"];

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("configurações: chaves por usuário em IA e Catálogo; globais e servidor só para o administrador", async ({
  page,
}) => {
  await signIn(page, "ana@deixa.example");
  await page.getByRole("button", { name: "Perfil de Ana" }).click();
  const profile = page.getByRole("dialog", { name: "Perfil e configurações" });
  await expect(profile.getByLabel("Chave: TMDB", { exact: true })).toHaveCount(0);
  await profile.getByRole("link", { name: "Configurações" }).click();
  await expect(page).toHaveURL(/\/settings/);

  for (const service of AI_SERVICES)
    await expect(page.getByLabel(`Chave: ${service}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Servidor" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Globais do servidor" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Catálogo" }).click();
  for (const service of CATALOG_SERVICES)
    await expect(page.getByLabel(`Chave: ${service}`, { exact: true })).toBeVisible();
  await page.getByLabel("Chave: TMDB", { exact: true }).fill("chave curta");
  await page.getByRole("button", { name: "Testar e salvar: TMDB", exact: true }).click();
  await expect(page.getByText(/Essa chave não parece válida\. Use o token de leitura/)).toBeVisible();
  await expect(page.getByText(/Chave ilegível/)).toHaveCount(0);

  await page.getByRole("tab", { name: "Uso da IA" }).click();
  await expect(page.getByText("Seu limite")).toBeVisible();
  await expect(page.getByText("Nenhuma chave de IA em uso.")).toBeVisible();

  await page.getByRole("button", { name: "Perfil de Ana" }).click();
  await profile.getByRole("button", { name: "Trocar de perfil" }).click();
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, "matheus@deixa.example");
  await page.getByRole("button", { name: "Mais áreas" }).click();
  await page
    .getByRole("dialog", { name: "Mais" })
    .getByRole("link", { name: /Configurações/ })
    .click();
  await expect(page).toHaveURL(/\/settings/);
  await page.getByRole("tab", { name: "Catálogo" }).click();
  await page.getByRole("link", { name: "Globais do servidor" }).click();
  for (const service of CATALOG_SERVICES) {
    await expect(page.getByLabel(`Chave: ${service} global`, { exact: true })).toBeVisible();
  }
  await page.getByLabel("Chave: OpenSubtitles global", { exact: true }).fill("com espaço!");
  await page.getByRole("button", { name: "Testar e salvar: OpenSubtitles global" }).click();
  await expect(page.getByText(/A chave de API do OpenSubtitles tem só letras e números/)).toBeVisible();

  await page.getByRole("tab", { name: "Uso da IA" }).click();
  await expect(page.getByText("Todas as contas · este mês")).toBeVisible();
  await expect(page.getByText("Limite padrão da chave global")).toBeVisible();
  await page.getByLabel("Por mês").first().fill("2,50");
  await page.getByRole("button", { name: "Salvar limite" }).first().click();
  await expect(page.getByText("Limite salvo.")).toBeVisible();

  await page.getByRole("tab", { name: "Servidor" }).click();
  await expect(page.getByLabel("Modelo do Gemini")).toHaveValue("gemini-2.5-flash");
  await page.getByLabel("Downloads de legenda por conta, por dia").fill("5000");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText(/downloads entre 0 e 1000/)).toBeVisible();
  await page.getByLabel("Downloads de legenda por conta, por dia").fill("37");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações do servidor salvas.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Downloads de legenda por conta, por dia")).toHaveValue("37");
});
