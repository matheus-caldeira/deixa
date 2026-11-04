import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DESKTOP_HOME, desktopTarget } from "./environment";

const ENGLISH = "fixtures/sample.en.srt";
const PORTUGUESE = "fixtures/sample.pt-BR.srt";
const CODE_FILE = join(DESKTOP_HOME, "setup-code.txt");

test("servidor empacotado numa instalação nova: banco → primeira conta → obra → leitura → cards", async ({
  page,
}) => {
  const target = desktopTarget();
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Código de configuração").fill(readFileSync(CODE_FILE, "utf8").trim());
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Usar um Postgres que já existe/ }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByRole("button", { name: `localhost:${target.port}` }).click();
  await page.getByLabel("Usuário do Postgres").fill(target.user);
  await page.getByLabel("Senha do Postgres").fill(target.password);
  await page.getByLabel("Nome do banco").fill(target.database);
  await page.getByRole("button", { name: "Testar e conectar" }).click();
  await expect(page).toHaveURL(/\/signup$/, { timeout: 60_000 });
  expect(existsSync(CODE_FILE)).toBe(true);
  await expect(page.getByLabel("Código de configuração")).toHaveCount(0);

  await page.getByLabel("Nome").fill("Dona");
  await page.getByLabel("E-mail").fill("dona@deixa.example");
  await page.getByLabel(/^Senha/).fill("deixa1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Perfil de Dona" })).toBeVisible();
  expect(existsSync(CODE_FILE)).toBe(false);

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
  await sheet.getByRole("button", { name: "Enviar arquivos .srt manualmente" }).click();
  await sheet.getByLabel("Arquivo da legenda em inglês").setInputFiles(ENGLISH);
  await sheet.getByLabel("Arquivo da legenda em português").setInputFiles(PORTUGUESE);
  await sheet.getByRole("button", { name: "Enviar e processar" }).click();
  await expect(sheet.getByText(/Episódio publicado/)).toBeVisible({ timeout: 60_000 });
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByText("Pronto · 23 falas")).toBeVisible();

  await page.getByRole("link", { name: "Ler e marcar a legenda: Pilot" }).click();
  const lines = page.getByTestId("line");
  await expect(lines).toHaveCount(23);
  await lines.filter({ hasText: "Deal." }).getByRole("button", { name: "Marcar a fala inteira" }).click();
  await expect(page.getByTestId("mark-count")).toHaveText("1");
  await page.getByRole("button", { name: "Gerar cards" }).click();
  await expect(page.getByText("Cards do episódio")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar 1 cards à revisão" }).click();
  await expect(page).toHaveURL(/\/review$/);
});
