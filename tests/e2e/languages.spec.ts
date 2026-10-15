import { expect, test } from "@playwright/test";

const PASSWORD = "deixa1234";
const SPANISH = "fixtures/sample.es.srt";
const PORTUGUESE = "fixtures/sample.pt-BR.srt";

test("conta nova estuda espanhol a partir do português e, ao trocar para inglês, a revisão não mistura", async ({
  page,
}) => {
  const email = `sofia-${Date.now()}@deixa.example`;
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Sofia");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(PASSWORD);
  await page.getByLabel("Seu idioma").selectOption("pt-BR");
  await page.getByLabel("Quero aprender").selectOption("es");
  await expect(page.getByLabel("Seu nível de espanhol hoje")).toBeVisible();
  await page.getByLabel("Seu nível de espanhol hoje").selectOption("A2");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Perfil de Sofia" })).toBeVisible();

  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Explorar" }).click();
  await page.getByRole("button", { name: "Adicionar, importar ou exportar" }).first().click();
  await page
    .getByRole("dialog", { name: "Catálogo" })
    .getByRole("button", { name: /^Adicionar/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Adicionar ao catálogo" });
  await sheet.getByLabel("Nome da série ou filme").fill("breaking");
  await sheet.getByRole("button", { name: /Breaking Bad/ }).click();
  await sheet.getByRole("button", { name: "Continuar" }).click();
  await expect(sheet.getByLabel("Episódio")).toContainText("E01");
  const episodeOptions = sheet.getByLabel("Episódio").locator("option");
  const labels = await episodeOptions.allTextContents();
  const free = labels.findIndex((label) => label.includes("(sem legenda)"));
  expect(free).toBeGreaterThanOrEqual(0);
  await sheet.getByLabel("Episódio").selectOption({ index: free });
  await sheet.getByRole("button", { name: "Enviar arquivos .srt manualmente" }).click();
  await sheet.getByLabel("Arquivo da legenda em espanhol").setInputFiles(SPANISH);
  await sheet.getByLabel("Arquivo da legenda em português").setInputFiles(PORTUGUESE);
  await sheet.getByRole("button", { name: "Enviar e processar" }).click();
  await expect(sheet.getByText("22 pares · 96%")).toBeVisible();
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Breaking Bad" })).toBeVisible();
  await expect(page.getByText("ES + PT", { exact: true })).toBeVisible();

  await page
    .getByRole("link", { name: /Ler e marcar a legenda/ })
    .first()
    .click();
  await expect(page.getByText("legenda ES + PT alinhada")).toBeVisible();
  await expect(page.getByText("Oye, ¿qué vas a hacer esta noche?")).toBeVisible();
  await page.getByRole("button", { name: "ES + PT", exact: true }).click();
  await expect(page.getByText("Ei, o que você vai fazer hoje à noite?")).toBeVisible();
  const lines = page.getByTestId("line");
  await lines.first().getByRole("button", { name: "Marcar a fala inteira" }).click();
  await expect(page.getByTestId("mark-count")).toHaveText("1");
  await page.getByRole("button", { name: "Gerar cards" }).click();
  await expect(page.getByRole("button", { name: /Adicionar 1 cards à revisão/ })).toBeVisible();
  await page.getByRole("button", { name: /Adicionar 1 cards à revisão/ }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByText("Oye, ¿qué vas a hacer esta noche?").first()).toBeVisible();

  await page.getByRole("button", { name: "Perfil de Sofia" }).click();
  const profile = page.getByRole("dialog", { name: "Perfil e configurações" });
  await expect(profile.getByText("espanhol a partir do português")).toBeVisible();
  await profile.getByRole("button", { name: "Estudar outro idioma" }).click();
  await profile.getByLabel("Quero aprender").selectOption("en");
  await profile.getByLabel("Nível nesse idioma").selectOption("B1");
  await profile.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(profile.getByText("inglês a partir do português")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "B1" })).toBeVisible();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Fila em dia" })).toBeVisible();

  await page.getByRole("button", { name: "Perfil de Sofia" }).click();
  await page
    .getByRole("dialog", { name: "Perfil e configurações" })
    .getByRole("button", { name: /espanhol a partir do português/ })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "A2" })).toBeVisible();
  await page.goto("/review");
  await expect(page.getByText("Oye, ¿qué vas a hacer esta noche?").first()).toBeVisible();
});
