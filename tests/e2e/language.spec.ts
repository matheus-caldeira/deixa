import { expect, test } from "@playwright/test";

const PASSWORD = "deixa1234";

test("trocar o idioma no perfil traduz a interface inteira, inclusive mensagens de erro", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("lucas@deixa.example");
  await page.getByLabel("Senha").fill("wrong-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();

  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: /Perfil de Lucas|Profile of Lucas/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Português (Brasil)" }).click();
  await expect(page.getByRole("dialog", { name: "Perfil e configurações" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Revisões de hoje" })).toBeVisible();

  await page.getByRole("button", { name: "Perfil de Lucas" }).click();
  const profile = page.getByRole("dialog", { name: "Perfil e configurações" });
  await profile.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("dialog", { name: "Profile and settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Today’s reviews" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "For you" })).toBeVisible();
  await page.getByRole("button", { name: "More areas" }).click();
  await page
    .getByRole("dialog", { name: "More" })
    .getByRole("link", { name: /Settings/ })
    .click();
  await expect(page.getByRole("tab", { name: "AI usage" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Profile of Lucas" }).click();
  await page
    .getByRole("dialog", { name: "Profile and settings" })
    .getByRole("button", { name: "Switch profile" })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

  await page.getByLabel("Email").fill("lucas@deixa.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today’s reviews" })).toBeVisible();

  await page.getByRole("button", { name: "Profile of Lucas" }).click();
  await page
    .getByRole("dialog", { name: "Profile and settings" })
    .getByRole("button", { name: "Português (Brasil)" })
    .click();
  await expect(page.getByRole("dialog", { name: "Perfil e configurações" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Revisões de hoje" })).toBeVisible();
});
