import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "deixa1234";
const SERVICES = ["Google AI (Gemini)", "TMDB", "OpenSubtitles"];

async function openProfile(page: Page, name: string, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: `Perfil de ${name}` }).click();
  return page.getByRole("dialog", { name: "Perfil e configurações" });
}

test("perfil: três chaves por usuário; chaves globais só para o administrador", async ({ page }) => {
  const sheet = await openProfile(page, "Ana", "ana@deixa.example");
  await expect(sheet.getByText("Suas chaves de API")).toBeVisible();
  for (const service of SERVICES)
    await expect(sheet.getByLabel(`Chave: ${service}`, { exact: true })).toBeVisible();
  await expect(sheet.getByText("Chaves globais (administrador)")).toHaveCount(0);
  await expect(sheet.getByLabel("Chave: TMDB global")).toHaveCount(0);

  await sheet.getByLabel("Chave: TMDB", { exact: true }).fill("chave curta");
  await sheet.getByRole("button", { name: "Testar e salvar: TMDB", exact: true }).click();
  await expect(sheet.getByText(/Essa chave não parece válida\. Use o token de leitura/)).toBeVisible();
  await expect(page.getByText(/Chave ilegível/)).toHaveCount(0);

  await sheet.getByRole("button", { name: "Trocar de perfil" }).click();
  await expect(page).toHaveURL(/\/login/);

  const adminSheet = await openProfile(page, "Matheus", "matheus@deixa.example");
  await expect(adminSheet.getByText("Chaves globais (administrador)")).toBeVisible();
  for (const service of SERVICES) {
    await expect(adminSheet.getByLabel(`Chave: ${service} global`, { exact: true })).toBeVisible();
  }
  await adminSheet.getByLabel("Chave: OpenSubtitles global", { exact: true }).fill("com espaço!");
  await adminSheet.getByRole("button", { name: "Testar e salvar: OpenSubtitles global" }).click();
  await expect(adminSheet.getByText(/A chave de API do OpenSubtitles tem só letras e números/)).toBeVisible();
});
