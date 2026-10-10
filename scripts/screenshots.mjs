#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "screenshots");
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:1300";
const PASSWORD = "deixa1234";
const PROFILE = process.env.SCREENSHOT_PROFILE ?? "Matheus";
const VIEWPORT = { width: 390, height: 844 };
const SCHEMES = ["light", "dark"];

async function shoot(page, name, scheme) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `${name}.${scheme}.png`) });
}

async function captureApp(browser, scheme) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: scheme, locale: "pt-BR" });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await shoot(page, "app-01-login", scheme);
  await page.getByRole("button", { name: new RegExp(`^. ${PROFILE} `) }).click();
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: `Entrar como ${PROFILE}` }).click();
  await page.getByRole("button", { name: `Perfil de ${PROFILE}` }).waitFor();
  await shoot(page, "app-02-home", scheme);
  await page.goto(`${BASE_URL}/catalog`);
  await shoot(page, "app-03-explore", scheme);
  await page.getByRole("link", { name: "How I Met Your Mother" }).first().click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, "app-04-detail", scheme);
  await page
    .getByRole("link", { name: /Ler e marcar a legenda/ })
    .nth(2)
    .click();
  await page.getByTestId("line").first().waitFor();
  await shoot(page, "app-05-read", scheme);
  await page.goto(`${BASE_URL}/review`);
  await shoot(page, "app-06-review", scheme);
  await page.goto(`${BASE_URL}/tutor`);
  await shoot(page, "app-07-talk", scheme);
  await page.goto(`${BASE_URL}/progress`);
  await shoot(page, "app-08-progress", scheme);
  await page.goto(`${BASE_URL}/catalog`);
  await page.getByRole("button", { name: /Adicionar episódio/ }).click();
  await shoot(page, "app-09-upload", scheme);
  await context.close();
}

async function capturePrototype(browser, scheme) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: scheme, locale: "pt-BR" });
  const page = await context.newPage();
  await page.goto(pathToFileURL(join(ROOT, "deixa.html")).href);
  await shoot(page, "proto-01-login", scheme);
  await page.locator(`[data-act="pick"][data-id="${PROFILE.toLowerCase()}"]`).click();
  await shoot(page, "proto-02-home", scheme);
  await page.locator('[data-act="tab"][data-t="explore"]').click();
  await shoot(page, "proto-03-explore", scheme);
  await page.locator('[data-act="openmedia"][data-id="himym"]').last().click();
  await shoot(page, "proto-04-detail", scheme);
  await page.locator('[data-act="opentx"][data-key="himym-1-3"]').click();
  await shoot(page, "proto-05-read", scheme);
  await page.locator('[data-act="txclose"]').click();
  await page.locator('[data-act="tab"][data-t="review"]').click();
  await shoot(page, "proto-06-review", scheme);
  await page.locator('[data-act="tab"][data-t="talk"]').click();
  await shoot(page, "proto-07-talk", scheme);
  await page.locator('.nav [data-t="progress"]').click();
  await shoot(page, "proto-08-progress", scheme);
  await page.locator('[data-act="tab"][data-t="explore"]').click();
  await page.locator('[data-act="sheet"][data-s="upload"]').click();
  await shoot(page, "proto-09-upload", scheme);
  await context.close();
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const scheme of SCHEMES) {
    await captureApp(browser, scheme);
    await capturePrototype(browser, scheme);
  }
} finally {
  await browser.close();
}
console.log(`screenshots em ${OUT}`);
