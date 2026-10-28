import { expect, test } from "@playwright/test";

test("a política de conteúdo do vercel.json não bloqueia o app", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
  });
  await page.goto("/lab/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("lab-status")).toHaveText("Banco aberto neste aparelho.", {
    timeout: 60_000,
  });
  expect(violations).toEqual([]);
});
