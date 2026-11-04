import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_SETUP_BASE_URL, E2E_SETUP_CONFIG_DIR, e2eSetupTarget } from "./environment";

const CODE_FILE = join(E2E_SETUP_CONFIG_DIR, "setup-code.txt");
const URL_FILE = join(E2E_SETUP_CONFIG_DIR, "database-url.txt");
const ONE_DAY_SECONDS = 24 * 60 * 60;

test("sem banco configurado: código → conexão → tabelas criadas → primeira conta é a administradora", async ({
  page,
  browser,
}) => {
  const target = e2eSetupTarget();
  await page.goto(`${E2E_SETUP_BASE_URL}/`);
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: "Configurar o banco de dados" })).toBeVisible();
  await expect(page.getByLabel("Servidor")).toHaveCount(0);

  await page.getByLabel("Código de configuração").fill("AAAA-BBBB-CCCC");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Código incorreto/)).toBeVisible();

  await page.getByLabel("Código de configuração").fill(readFileSync(CODE_FILE, "utf8").trim().toLowerCase());
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Usar um Postgres que já existe/ }).click();
  await expect(page.getByRole("button", { name: /Usar um Postgres que já existe/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Testar e conectar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Postgres encontrado neste computador")).toBeVisible();
  await page.getByRole("button", { name: `localhost:${target.port}` }).click();
  await expect(page.getByLabel("Porta")).toHaveValue(target.port);

  await page.getByLabel("Usuário do Postgres").fill(target.user);
  await page.getByLabel("Senha do Postgres").fill("senha-errada");
  await page.getByLabel("Nome do banco").fill(target.database);
  await page.getByRole("button", { name: "Testar e conectar" }).click();
  await expect(page.getByText("Usuário ou senha recusados pelo Postgres.")).toBeVisible();
  expect(existsSync(URL_FILE)).toBe(false);

  await page.getByLabel("Senha do Postgres").fill(target.password);
  await page.getByRole("button", { name: "Testar e conectar" }).click();
  await expect(page).toHaveURL(/\/signup$/, { timeout: 30_000 });
  expect(existsSync(URL_FILE)).toBe(true);
  expect(existsSync(CODE_FILE)).toBe(true);
  await expect(page.getByLabel("Código de configuração")).toHaveCount(0);

  const stranger = await browser.newContext({ locale: "pt-BR" });
  const strangerPage = await stranger.newPage();
  await strangerPage.setExtraHTTPHeaders({ "X-Forwarded-For": "127.0.0.1" });
  await strangerPage.goto(`${E2E_SETUP_BASE_URL}/signup`);
  await strangerPage.getByLabel("Código de configuração").fill("AAAA-BBBB-CCCC");
  await strangerPage.getByLabel("Nome").fill("Intrusa");
  await strangerPage.getByLabel("E-mail").fill("intrusa@deixa.example");
  await strangerPage.getByLabel(/^Senha/).fill("deixa1234");
  await strangerPage.getByRole("button", { name: "Criar conta" }).click();
  await expect(strangerPage.getByText(/Código de configuração ausente ou incorreto/)).toBeVisible();
  await strangerPage.goto(`${E2E_SETUP_BASE_URL}/setup/unlock?code=AAAA-BBBB-CCCC`);
  await expect(strangerPage).toHaveURL(/\/signup$/);
  await expect(strangerPage.getByLabel("Código de configuração")).toBeVisible();
  await stranger.close();

  const owner = await browser.newContext({ locale: "pt-BR" });
  const ownerPage = await owner.newPage();
  await ownerPage.goto(`${E2E_SETUP_BASE_URL}/setup/unlock?code=${readFileSync(CODE_FILE, "utf8").trim()}`);
  await expect(ownerPage).toHaveURL(/\/signup$/);
  await expect(ownerPage.getByLabel("Código de configuração")).toHaveCount(0);
  const [setupCookie] = (await owner.cookies()).filter((cookie) => cookie.name === "deixa_setup");
  expect(setupCookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + ONE_DAY_SECONDS);
  await owner.close();

  await page.getByLabel("Nome").fill("Dona");
  await page.getByLabel("E-mail").fill("dona@deixa.example");
  await page.getByLabel(/^Senha/).fill("deixa1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Perfil de Dona" })).toBeVisible();
  expect(existsSync(CODE_FILE)).toBe(false);
  await page.goto(`${E2E_SETUP_BASE_URL}/settings?tab=catalog&scope=global`);
  await expect(page.getByLabel("Chave: TMDB global", { exact: true })).toBeVisible();

  await page.goto(`${E2E_SETUP_BASE_URL}/setup`);
  await expect(page).not.toHaveURL(/\/setup$/);
});
