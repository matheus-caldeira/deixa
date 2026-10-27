import { expect, test, type Page } from "@playwright/test";

const BYTES_PER_MB = 1_048_576;

async function waitForReady(page: Page) {
  await expect(page.getByTestId("lab-status")).toHaveText("Banco aberto neste aparelho.", {
    timeout: 60_000,
  });
}

async function accounts(page: Page): Promise<number> {
  const text = (await page.getByTestId("lab-probe").textContent()) ?? "";
  return Number(text.split(" ")[0]);
}

test("banco no navegador grava, reabre, trava a segunda aba e navega sem rede", async ({ context, page }) => {
  await page.goto("/lab/");
  await waitForReady(page);
  const before = await accounts(page);
  await page.getByRole("button", { name: "Criar conta de prova" }).click();
  await expect.poll(() => accounts(page)).toBe(before + 1);

  const second = await context.newPage();
  await second.goto("/lab/");
  await expect(second.getByTestId("lab-status")).toHaveText(
    "Esperando o banco: ele está aberto em outra aba.",
  );

  await page.close();
  await waitForReady(second);
  await expect.poll(() => accounts(second)).toBe(before + 1);

  const timing = await second.getByTestId("lab-timing").textContent();
  const memory = await second.evaluate(async () => {
    const measure = (
      performance as unknown as { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> }
    ).measureUserAgentSpecificMemory;
    return measure ? (await measure.call(performance)).bytes : null;
  });
  const storage = await second.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
  console.info(
    `prova: ${timing}; memória ${memory === null ? "indisponível" : Math.round(memory / BYTES_PER_MB)} MB; espaço ${Math.round(storage / BYTES_PER_MB)} MB`,
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
  await expect.poll(() => accounts(second)).toBe(before + 1);
  await context.setOffline(false);
});
