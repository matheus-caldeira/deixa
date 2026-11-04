import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_FIRST_ACCOUNT_BASE_URL, E2E_FIRST_ACCOUNT_CONFIG_DIR } from "./environment";

const CODE_FILE = join(E2E_FIRST_ACCOUNT_CONFIG_DIR, "setup-code.txt");

test("banco do .env sem contas: a primeira conta nasce do código digitado no cadastro", async ({
  page,
  browser,
}) => {
  expect(existsSync(CODE_FILE)).toBe(true);
  const code = readFileSync(CODE_FILE, "utf8").trim();
  expect(code).toContain("-");

  await page.goto(`${E2E_FIRST_ACCOUNT_BASE_URL}/signup`);
  await expect(page.getByLabel("Código de configuração")).toBeVisible();
  await page.getByLabel("Nome").fill("Dona");
  await page.getByLabel("E-mail").fill("dona@deixa.example");
  await page.getByLabel(/^Senha/).fill("deixa1234");

  await page.getByLabel("Código de configuração").fill("AAAA-BBBB-CCCC");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(/Código de configuração ausente ou incorreto/)).toBeVisible();
  expect(existsSync(CODE_FILE)).toBe(true);

  await page.getByLabel("Código de configuração").fill(code.replaceAll("-", "").toLowerCase());
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Perfil de Dona" })).toBeVisible();
  expect(existsSync(CODE_FILE)).toBe(false);
  await page.goto(`${E2E_FIRST_ACCOUNT_BASE_URL}/settings?tab=catalog&scope=global`);
  await expect(page.getByLabel("Chave: TMDB global", { exact: true })).toBeVisible();

  const second = await browser.newContext({ locale: "pt-BR" });
  const secondPage = await second.newPage();
  await secondPage.goto(`${E2E_FIRST_ACCOUNT_BASE_URL}/signup`);
  await expect(secondPage.getByLabel("Nome")).toBeVisible();
  await expect(secondPage.getByLabel("Código de configuração")).toHaveCount(0);
  await second.close();
});
