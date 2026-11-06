import { expect, test } from "@playwright/test";

const PASSWORD = "deixa1234";
const SHOTS = ".superpowers/planning/music-screens";
const VIDEO = "https://youtu.be/dQw4w9WgXcQ";

test("música: criar playlist, adicionar com letra, ouvir, ajustar a sincronia e abrir a leitura", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("matheus@deixa.example");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Perfil de Matheus" })).toBeVisible();

  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Explorar" }).click();
  await page.getByTestId("music-entry").click();
  await expect(page.getByRole("heading", { level: 1, name: "Músicas" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${SHOTS}/01-musicas.png` });
  await page.getByLabel("Nome").fill("Treino de e2e");
  await page.getByRole("button", { name: "Criar playlist" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Treino de e2e" })).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/02-playlist-vazia.png` });
  await page.getByRole("button", { name: "Adicionar música" }).click();
  const sheet = page.getByRole("dialog", { name: "Adicionar música" });
  await sheet.getByLabel("Link do vídeo do YouTube").fill(VIDEO);
  await sheet.getByLabel("Artista").fill("Lanterna Azul");
  await sheet.getByLabel("Música", { exact: true }).fill("Morning Window");
  await sheet.getByRole("button", { name: "Buscar letras" }).click();
  await sheet.getByRole("radio").first().click();
  await sheet.getByLabel("Traduzir com IA se eu não colar a tradução").uncheck();
  await page.screenshot({ path: `${SHOTS}/03-adicionar.png` });
  await sheet.getByRole("button", { name: "Adicionar à playlist" }).click();

  const row = page.getByTestId("song-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Morning Window");

  await row.getByRole("link", { name: /Ouvir/ }).click();
  await expect(page).toHaveURL(/\/listen\?episode=/);
  const line = page.getByRole("button", { name: "The light comes in through the window" });
  await expect(line).toBeVisible();
  await line.click();
  await expect(line).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: `${SHOTS}/04-ouvir.png` });

  await page.getByRole("button", { name: "Sincronia" }).click();
  await page.getByRole("button", { name: "+0,5" }).click();
  await expect(page.getByText("Atraso inicial: 0,5 s")).toBeVisible();
  await page.getByRole("button", { name: "Pausa aqui" }).click();
  await expect(page.getByText(/pausa de 10,0 s/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-sincronia.png` });
  await page.getByRole("button", { name: "Salvar sincronia" }).click();
  await expect(page.getByText("Sincronia salva.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Sincronia" }).click();
  await expect(page.getByText("Atraso inicial: 0,5 s")).toBeVisible();
  await expect(page.getByText(/pausa de 10,0 s/)).toBeVisible();

  await page.getByRole("link", { name: "Ler e marcar" }).click();
  await expect(page).toHaveURL(/\/read\?id=/);
});
