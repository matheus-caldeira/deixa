import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "deixa1234";
const ENGLISH = "fixtures/sample.en.srt";
const PORTUGUESE = "fixtures/sample.pt-BR.srt";

async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Ana|Matheus|Lucas/ })).toHaveCount(0);
  await page.getByLabel("E-mail").fill(`${name.toLowerCase()}@deixa.example`);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: `Perfil de ${name}` })).toBeVisible();
}

async function signOut(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: `Perfil de ${name}` }).click();
  const profile = page.getByRole("dialog", { name: "Perfil e configurações" });
  await profile.getByRole("button", { name: "Fechar" }).click();
  await expect(profile).toHaveCount(0);
  await page.getByRole("button", { name: `Perfil de ${name}` }).click();
  await page.getByRole("button", { name: "Trocar de perfil" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function attachSubtitles(page: Page) {
  await page.getByLabel("Arquivo da legenda em inglês").setInputFiles(ENGLISH);
  await page.getByLabel("Arquivo da legenda em português").setInputFiles(PORTUGUESE);
  await page.getByRole("button", { name: "Enviar e processar" }).click();
}

test("login → buscar obra → upload EN+PT → ler → marcar → gerar cards → revisar, com isolamento entre usuários", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, "Matheus");
  await expect(page.getByRole("link", { name: "B1" })).toBeVisible();

  for (const [label, heading] of [
    ["Explorar", "Explorar"],
    ["Revisar", "Revisar"],
    ["Conversar", "Conversar"],
    ["Progresso", "Progresso"],
  ] as const) {
    await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Explorar" }).click();
  await page.getByRole("button", { name: "Adicionar episódio com legenda .srt" }).click();
  const sheet = page.getByRole("dialog", { name: "Adicionar ao catálogo" });
  await sheet.getByLabel("Nome da série ou filme").fill("modern");
  await sheet.getByRole("button", { name: /Modern Family/ }).click();
  await sheet.getByRole("button", { name: "Continuar" }).click();
  await expect(sheet.getByRole("heading", { name: "Modern Family" })).toBeVisible();
  await expect(sheet.getByLabel("Temporada")).toHaveValue("1");
  await expect(sheet.getByLabel("Episódio")).toContainText("E01 · Pilot");
  await attachSubtitles(page);

  await expect(sheet.getByText("Alinhando EN ↔ PT pelo tempo")).toBeVisible();
  await expect(sheet.getByText("22 pares · 96%")).toBeVisible();
  await expect(sheet.getByText(/Episódio publicado/)).toBeVisible();
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Modern Family" })).toBeVisible();
  await expect(page.getByText("Pronto · 23 falas")).toBeVisible();
  await expect(page.getByText("EN + PT", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Enviar legenda de outro episódio" }).click();
  await expect(sheet.getByLabel("Episódio")).toContainText("E01 · Pilot");
  await sheet.getByLabel("Episódio").selectOption({ label: "E01 · Pilot (pronto)" });
  await attachSubtitles(page);
  await expect(sheet.getByText("legenda idêntica encontrada")).toBeVisible();
  await expect(sheet.getByText(/Essa legenda já existe no catálogo/)).toBeVisible();
  await sheet.getByRole("button", { name: "Ver no catálogo" }).click();
  await expect(page.getByText("Pronto · 23 falas")).toHaveCount(1);

  await page.getByRole("link", { name: "Ler e marcar a legenda: Pilot" }).click();
  await expect(page).toHaveURL(/\/read\//);
  const readUrl = page.url();
  const lines = page.getByTestId("line");
  await expect(lines).toHaveCount(23);
  await expect(page.getByText("CENA 1 · 00:01:05")).toBeVisible();
  await expect(page.getByText("legenda EN + PT alinhada")).toBeVisible();

  const firstTranslation = page.getByText("Ei, o que você vai fazer hoje à noite?");
  await expect(firstTranslation).toHaveCount(0);
  await lines.first().getByRole("button", { name: "ver tradução" }).click();
  await expect(firstTranslation).toBeVisible();
  await page.getByRole("button", { name: "EN + PT", exact: true }).click();
  await expect(page.getByText("Nada demais. Ia ficar em casa e colocar o sono em dia.")).toBeVisible();
  await expect(page.getByRole("button", { name: "traduzir com IA" })).toHaveCount(1);
  await page.getByRole("button", { name: "Só inglês" }).click();
  await expect(firstTranslation).toHaveCount(0);
  await page.getByRole("button", { name: "EN + PT", exact: true }).click();

  await page.getByLabel("Procurar uma fala").fill("dividiram");
  await expect(lines).toHaveCount(1);
  await page.getByLabel("Procurar uma fala").fill("");
  await expect(lines).toHaveCount(23);

  const billLine = lines.filter({ hasText: "split the bill" });
  for (const word of ["split", "the", "bill?"]) {
    await billLine.getByRole("button", { name: word, exact: true }).click();
  }
  await expect(page.getByTestId("mark-count")).toHaveText("1");
  await lines.filter({ hasText: "Deal." }).getByRole("button", { name: "Marcar a fala inteira" }).click();
  await expect(page.getByTestId("mark-count")).toHaveText("2");

  const firstAudio = page.waitForResponse((response) => response.url().includes("/api/audio/cue/"));
  await lines.first().getByRole("button", { name: "Ouvir a fala" }).click();
  const generated = await firstAudio;
  expect(generated.status()).toBe(200);
  expect(generated.headers()["x-audio-cache"]).toBe("miss");
  const cached = await page.request.get(generated.url());
  expect(cached.headers()["x-audio-cache"]).toBe("hit");
  expect(cached.headers()["content-type"]).toBe("audio/wav");

  await page.getByRole("button", { name: "Gerar cards" }).click();
  await expect(page.getByText("Cards do episódio")).toBeVisible();
  await expect(page.getByText("split the bill", { exact: true })).toBeVisible();
  await expect(page.getByText("dividir a conta")).toBeVisible();
  await expect(page.getByText("Fechado. A primeira rodada é por minha conta.")).toBeVisible();
  await expect(page.getByText(/Ninguém vê o que você marcou/)).toBeVisible();
  await page.getByRole("button", { name: "Adicionar 2 cards à revisão" }).click();

  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByText("1/8 · 8 na fila")).toBeVisible();
  let foundNewCard = false;
  for (let position = 0; position < 8 && !foundNewCard; position += 1) {
    foundNewCard = await page
      .locator(".face:not(.back)")
      .getByText("split the bill", { exact: true })
      .isVisible();
    await page.getByRole("button", { name: "Mostrar resposta" }).click();
    if (foundNewCard) {
      await expect(page.locator(".face.back").getByText("dividir a conta")).toBeVisible();
      await expect(page.getByText("Modern Family · T1 · E1 · suas marcações").first()).toBeVisible();
    }
    await page.getByRole("button", { name: /^Bom/ }).click();
    await expect(page.getByText(`${7 - position} na fila`).or(page.getByText("Fila em dia"))).toBeVisible();
  }
  expect(foundNewCard).toBe(true);

  await page.goto(readUrl);
  await expect(page.getByTestId("mark-count")).toHaveText("0");
  await expect(page.locator(".w.mk")).toHaveCount(3);

  await page.goto("/");
  await expect(page.getByText("COMEÇAR")).toBeVisible();
  await expect(page.getByText(/70% de acerto para liberar o próximo/)).toBeVisible();
  await page.getByRole("link", { name: "Continuar estudando" }).click();
  await expect(page).toHaveURL(/\/study\/.+\/2$/);
  const finished = page.getByRole("heading", { name: /Ainda não foi desta vez|Bloco (perfeito|concluído)!/ });
  for (let step = 0; step < 12; step += 1) {
    await expect(finished.or(page.getByRole("button", { name: /^(Verificar|Entendi)$/ }))).toBeVisible();
    if (await finished.isVisible()) break;
    for (const option of await page.locator(".opt").all()) {
      expect(await option.innerText()).toBe((await option.innerText()).toLowerCase());
    }
    if ((await page.locator(".opt").count()) > 0) await page.locator(".opt").first().click();
    else if ((await page.locator(".bank .tok").count()) > 0) await page.locator(".bank .tok").first().click();
    else if ((await page.locator("textarea").count()) > 0) await page.locator("textarea").fill("teste");
    await page.getByRole("button", { name: /^(Verificar|Entendi)$/ }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await expect(finished).toBeVisible();
  if (await page.getByRole("heading", { name: "Ainda não foi desta vez" }).isVisible()) {
    await expect(page.getByText(/Você precisa de 70% de acerto/)).toBeVisible();
    await expect(page.locator(".dstat").first()).toContainText("+0");
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await page.getByRole("button", { name: "Voltar ao início" }).click();
  } else {
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Perfil de Matheus" })).toBeVisible();
  await expect(page.getByText("Desafio final")).toBeVisible();

  await page.getByRole("link", { name: /XP hoje/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quem está estudando" })).toBeVisible();
  await expect(page.getByText("41 dias")).toBeVisible();
  await expect(page.getByText("você", { exact: true })).toHaveCount(1);

  await signOut(page, "Matheus");
  await signIn(page, "Ana");
  await expect(page.getByRole("link", { name: "A1" })).toBeVisible();
  await page.goto(readUrl);
  await expect(page.getByTestId("line")).toHaveCount(23);
  await expect(page.getByTestId("mark-count")).toHaveText("0");
  await expect(page.locator(".w.mk")).toHaveCount(0);
  await expect(page.locator(".tline.mk")).toHaveCount(0);
  await expect(page.getByText("Ei, o que você vai fazer hoje à noite?")).toBeVisible();
  await page.goto("/review");
  await expect(page.getByText("1/9 · 9 na fila")).toBeVisible();
  await expect(page.getByText("split the bill")).toHaveCount(0);
});
