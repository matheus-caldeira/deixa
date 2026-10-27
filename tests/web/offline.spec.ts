import { expect, test, type Page } from "@playwright/test";

const BYTES_PER_MB = 1_048_576;

async function waitForReady(page: Page) {
  await expect(page.getByTestId("lab-status")).toHaveText("Banco aberto neste aparelho.", {
    timeout: 60_000,
  });
}

test("conta criada no navegador sobrevive à recarga, trava a segunda aba e abre sem rede", async ({
  context,
  page,
}) => {
  await page.goto("/lab/");
  await waitForReady(page);
  await page.getByRole("button", { name: "Criar conta de prova" }).click();
  await expect(page.getByTestId("lab-probe")).toContainText("Conta: Prova", { timeout: 30_000 });

  const second = await context.newPage();
  await second.goto("/lab/");
  await expect(second.getByTestId("lab-status")).toHaveText(
    "Esperando o banco: ele está aberto em outra aba.",
  );
  await page.close();
  await waitForReady(second);
  await expect(second.getByTestId("lab-probe")).toContainText("Conta: Prova");

  const timing = await second.getByTestId("lab-timing").textContent();
  const memory = await second.evaluate(async () => {
    const measure = (
      performance as unknown as { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> }
    ).measureUserAgentSpecificMemory;
    return measure ? (await measure.call(performance)).bytes : null;
  });
  const storage = await second.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
  console.info(
    `prova: ${timing} memória ${memory === null ? "indisponível" : Math.round(memory / BYTES_PER_MB)} MB; espaço ${Math.round(storage / BYTES_PER_MB)} MB`,
  );

  await second.evaluate(() => navigator.serviceWorker.ready);
  await second.reload();
  await expect.poll(() => second.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await waitForReady(second);

  await context.setOffline(true);
  await second.getByRole("link", { name: "Tela b" }).click();
  await expect(second.getByTestId("lab-detail")).toHaveText("Tela b");
  await second.goto("/lab/detail/?id=c");
  await expect(second.getByTestId("lab-detail")).toHaveText("Tela c");
  await second.goto("/lab/");
  await waitForReady(second);
  await expect(second.getByTestId("lab-probe")).toContainText("Conta: Prova");
  await context.setOffline(false);
});
