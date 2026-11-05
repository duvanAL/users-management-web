import { expect, test } from "@playwright/test";

test.use({ channel: "chrome" });

const email = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Correo electrónico" });
const password = (page: import("@playwright/test").Page) =>
  page.locator('input[name="password"]');
const submit = (page: import("@playwright/test").Page) =>
  page.locator(".login-submit");

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await expect(submit(page)).toBeEnabled();
});

test("rejected credentials mark the fields and return focus", async ({
  page,
}) => {
  await email(page).fill("admin@dev.local");
  await password(page).fill("ClaveIncorrecta1!");
  await submit(page).click();

  await expect(page.locator("#login-error")).toHaveText(
    "Revisa tu correo y contraseña.",
  );
  await expect(password(page)).toHaveAttribute("aria-invalid", "true");
  await expect(email(page)).toHaveAttribute("aria-describedby", "login-error");
  await expect(password(page)).toBeFocused();

  await password(page).pressSequentially("x");
  await expect(password(page)).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#login-error")).toHaveCount(0);
});

test("demo access fills the form without submitting", async ({ page }) => {
  await page.getByText("Accesos de demostración").click();
  await page.getByRole("button", { name: /^Revisor/ }).click();

  await expect(email(page)).toHaveValue("auditor@dev.local");
  await expect(password(page)).toHaveValue("DevReview123!");
  await expect(submit(page)).toBeFocused();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".login")).toHaveAttribute("data-lit", "2");
  await expect(page.locator(".orbit-accounts")).toHaveAttribute(
    "data-on",
    "true",
  );
});

test("password visibility toggles", async ({ page }) => {
  await password(page).fill("DevAdmin123!");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(password(page)).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar contraseña" }).click();
  await expect(password(page)).toHaveAttribute("type", "password");
});

test("valid credentials reach the dashboard", async ({ page }) => {
  await email(page).fill("admin@dev.local");
  await password(page).fill("DevAdmin123!");
  await submit(page).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
