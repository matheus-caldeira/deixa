import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "deixa1234";
const NEW_PASSWORD = "outrasenha99";
const NEW_NAME = "Bia";
const NEW_EMAIL = "bia@deixa.example";

async function signIn(page: Page, name: string, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: `Perfil de ${name}` })).toBeVisible();
}

async function signOut(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: `Perfil de ${name}` }).click();
  await page.getByRole("button", { name: "Trocar de perfil" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

function accountRow(page: Page, email: string) {
  return page.locator(`[data-account="${email}"]`);
}

test("administrador cria, promove, redefine a senha e remove uma conta; conta comum não vê a gestão", async ({
  page,
}) => {
  await signIn(page, "Matheus", "matheus@deixa.example");
  await page.goto("/settings?tab=server");
  await page.getByRole("link", { name: /Contas/ }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole("heading", { level: 1, name: "Contas" })).toBeVisible();
  await expect(accountRow(page, "matheus@deixa.example").getByText("você")).toBeVisible();

  await page.getByRole("button", { name: "Criar conta" }).click();
  const create = page.getByRole("dialog", { name: "Criar conta" });
  await create.getByLabel("Nome").fill(NEW_NAME);
  await create.getByLabel("E-mail").fill(NEW_EMAIL);
  await create.getByLabel("Senha inicial").fill(PASSWORD);
  await create.getByRole("button", { name: "Criar conta" }).click();
  await expect(create).toHaveCount(0);
  const row = accountRow(page, NEW_EMAIL);
  await expect(row).toBeVisible();
  await expect(row.getByText("nunca entrou")).toBeVisible();
  await expect(row.getByText("admin", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Criar conta" }).click();
  await create.getByLabel("Nome").fill(NEW_NAME);
  await create.getByLabel("E-mail").fill(NEW_EMAIL);
  await create.getByLabel("Senha inicial").fill(PASSWORD);
  await create.getByRole("button", { name: "Criar conta" }).click();
  await expect(create.getByText("Já existe uma conta com esse e-mail.")).toBeVisible();
  await create.getByRole("button", { name: "Fechar" }).click();

  await row.getByRole("button", { name: `Gerenciar ${NEW_NAME}` }).click();
  const manage = page.getByRole("dialog", { name: `Gerenciar ${NEW_NAME}` });
  await manage.getByRole("button", { name: "Tornar administrador" }).click();
  await expect(manage).toHaveCount(0);
  await expect(row.getByText("admin", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: `Gerenciar ${NEW_NAME}` }).click();
  await manage.getByRole("button", { name: "Redefinir senha" }).click();
  await manage.getByLabel("Nova senha").fill(NEW_PASSWORD);
  await manage.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(manage).toHaveCount(0);

  await accountRow(page, "matheus@deixa.example").getByRole("button", { name: "Gerenciar Matheus" }).click();
  const self = page.getByRole("dialog", { name: "Gerenciar Matheus" });
  await expect(self.getByRole("button", { name: "Remover conta" })).toHaveCount(0);
  await self.getByRole("button", { name: "Fechar" }).click();

  await signOut(page, "Matheus");
  await signIn(page, NEW_NAME, NEW_EMAIL, NEW_PASSWORD);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { level: 1, name: "Contas" })).toBeVisible();
  await signOut(page, NEW_NAME);

  await signIn(page, "Matheus", "matheus@deixa.example");
  await page.goto("/accounts");
  await row.getByRole("button", { name: `Gerenciar ${NEW_NAME}` }).click();
  await manage.getByRole("button", { name: "Remover conta" }).click();
  await expect(manage.getByText(`Remover a conta de ${NEW_NAME}?`)).toBeVisible();
  await manage.getByRole("button", { name: "Manter conta" }).click();
  await manage.getByRole("button", { name: "Remover conta" }).click();
  await manage.getByRole("button", { name: "Remover de vez" }).click();
  await expect(manage).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await signOut(page, "Matheus");

  await signIn(page, "Ana", "ana@deixa.example");
  await page.goto("/settings?tab=server");
  await expect(page.getByRole("tab", { name: "Servidor" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Contas/ })).toHaveCount(0);
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Contas" })).toHaveCount(0);
});
