import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const RATE = 16_000;
const SPEECH_SECONDS = 0.8;
const SILENCE_SECONDS = 2.5;
const TONE_HZ = 220;
const AMPLITUDE = 0.5;
const CLIP = resolve(join("test-results", "voice-call.wav"));

function speechThenSilence(): Buffer {
  const total = Math.round(RATE * (SPEECH_SECONDS + SILENCE_SECONDS));
  const data = Buffer.alloc(total * 2);
  for (let index = 0; index < total; index += 1) {
    const speaking = index < RATE * SPEECH_SECONDS;
    const value = speaking ? Math.sin((2 * Math.PI * TONE_HZ * index) / RATE) * AMPLITUDE : 0;
    data.writeInt16LE(Math.round(value * 32_767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync("test-results", { recursive: true });
writeFileSync(CLIP, speechThenSilence());

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${CLIP}`,
    ],
  },
});

test("chamada de voz: fala, pausa, o tutor responde e volta a ouvir", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("lucas@deixa.example");
  await page.getByLabel("Senha").fill("deixa1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Perfil de Lucas" })).toBeVisible();
  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Conversar" }).click();
  await page.getByRole("button", { name: /^Comida/ }).click();
  await expect(page).toHaveURL(/\/tutor\/chat\?id=.+/);

  await page.getByRole("button", { name: "Chamada de voz" }).click();
  await expect(page.getByText(/^Ouvindo/)).toBeVisible();
  await expect(page.getByText("I recorded an audio message.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Ouvindo/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Encerrar chamada" }).click();
  await expect(page.getByRole("button", { name: "Chamada de voz" })).toBeVisible();
});

test("falar a frase no card manda a gravação para a transcrição", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("lucas@deixa.example");
  await page.getByLabel("Senha").fill("deixa1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Perfil de Lucas" })).toBeVisible();
  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: "Revisar" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: "Falar a frase" }).click();
  await expect(page.getByRole("button", { name: "Parar e conferir" })).toBeVisible();
  await page.getByRole("button", { name: "Parar e conferir" }).click();
  await expect(
    page
      .getByText("Configure uma chave de IA para transcrever a sua fala.")
      .or(page.getByTestId("pronunciation-result")),
  ).toBeVisible({ timeout: 30_000 });
});
