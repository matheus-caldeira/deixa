import { expect, test } from "@playwright/test";

const PASSWORD = "deixa1234";
const RELEASE = "Sample.Show.S01E01.720p.WEB-DEMO";

test("escolher episódio → buscar legendas → confirmar → processar → ler com EN + PT e origem", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("lucas@deixa.example");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Perfil de Lucas" })).toBeVisible();

  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Explorar" }).click();
  await page.getByRole("button", { name: "Adicionar episódio com legenda .srt" }).click();
  const sheet = page.getByRole("dialog", { name: "Adicionar ao catálogo" });
  await sheet.getByLabel("Nome da série ou filme").fill("brooklyn");
  await sheet.getByRole("button", { name: /Brooklyn Nine-Nine/ }).click();
  await sheet.getByRole("button", { name: "Continuar" }).click();
  await expect(sheet.getByRole("heading", { name: "Brooklyn Nine-Nine" })).toBeVisible();
  await expect(sheet.getByLabel("Episódio")).toContainText("E01");

  await expect(sheet.getByText(/Nada é baixado\s+até você confirmar/)).toBeVisible();
  await expect(sheet.getByText(RELEASE)).toHaveCount(0);
  await sheet.getByRole("button", { name: "Buscar legendas" }).click();
  await expect(sheet.getByText("EN e PT do mesmo release")).toBeVisible();
  await expect(sheet.getByText(`EN · ${RELEASE}`)).toBeVisible();
  await expect(sheet.getByText(`PT · ${RELEASE}`)).toBeVisible();
  await expect(sheet.getByText("1.200 downloads")).toBeVisible();
  await expect(sheet.getByText(/Downloads restantes hoje: informado/)).toBeVisible();

  await sheet.getByRole("button", { name: "Ver outras opções em inglês" }).click();
  await expect(sheet.getByText("Sample.Show.S01E01.HDTV-OTHER")).toBeVisible();
  await expect(sheet.getByText("Com descrição de sons")).toBeVisible();
  await sheet.getByRole("button", { name: "Ver outras opções em inglês" }).click();

  await sheet.getByRole("button", { name: "Baixar e processar · 2 downloads" }).click();
  await expect(sheet.getByText("Baixando do OpenSubtitles")).toBeVisible();
  await expect(sheet.getByText("2 download(s)")).toBeVisible();
  await expect(sheet.getByText("Alinhando EN ↔ PT pelo tempo")).toBeVisible();
  await expect(sheet.getByText(/Episódio publicado/)).toBeVisible();
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Brooklyn Nine-Nine" })).toBeVisible();
  await expect(page.getByText("Pronto · 23 falas")).toBeVisible();
  await expect(page.getByText("EN + PT", { exact: true })).toBeVisible();

  await page
    .getByRole("link", { name: /Ler e marcar a legenda/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/read\//);
  await expect(page.getByTestId("line")).toHaveCount(23);
  await expect(page.getByText("legenda EN + PT alinhada")).toBeVisible();
  await expect(page.getByText(`Legenda EN: OpenSubtitles · ${RELEASE} · demo`)).toBeVisible();
  await expect(page.getByText(`Legenda PT: OpenSubtitles · ${RELEASE} · demo`)).toBeVisible();
  await page.getByRole("button", { name: "EN + PT", exact: true }).click();
  await expect(page.getByText("Ei, o que você vai fazer hoje à noite?")).toBeVisible();

  await page.goBack();
  await page.getByRole("button", { name: "Enviar legenda de outro episódio" }).click();
  await sheet.getByLabel("Episódio").selectOption({ index: 0 });
  await sheet.getByRole("button", { name: "Buscar legendas" }).click();
  await expect(sheet.getByText("Este episódio já tem as duas legendas do OpenSubtitles.")).toBeVisible();
  await expect(sheet.getByText(/Downloads restantes hoje: 8/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Baixar e processar/ })).toBeDisabled();
});
