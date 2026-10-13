import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_SETUP_BASE_URL, E2E_SETUP_CONFIG_DIR, e2eSetupTarget } from "./environment";

const CODE_FILE = join(E2E_SETUP_CONFIG_DIR, "setup-code.txt");
const URL_FILE = join(E2E_SETUP_CONFIG_DIR, "database-url.txt");

test("sem banco configurado: código → conexão → tabelas criadas → primeira conta é a administradora", async ({
  page,
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
  expect(existsSync(CODE_FILE)).toBe(false);

  await page.getByLabel("Nome").fill("Dona");
  await page.getByLabel("E-mail").fill("dona@deixa.example");
  await page.getByLabel(/^Senha/).fill("deixa1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Perfil de Dona" })).toBeVisible();
  await page.goto(`${E2E_SETUP_BASE_URL}/settings?tab=catalog&scope=global`);
  await expect(page.getByLabel("Chave: TMDB global", { exact: true })).toBeVisible();

  await page.goto(`${E2E_SETUP_BASE_URL}/setup`);
  await expect(page).not.toHaveURL(/\/setup$/);
});
