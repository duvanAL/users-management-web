import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("anonymous workspace redirects to login", async ({ page }) => {
  await page.goto("/files");
  await expect(page).toHaveURL(/login/);
});
test("login has no serious accessibility violations or horizontal overflow", async ({
  page,
}) => {
  await page.goto("/login");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter((x) =>
      ["serious", "critical"].includes(x.impact || ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("motion preference persists across navigation", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Reducido", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});

test("all workspace routes render without uncaught errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Correo electrónico" })
    .fill("admin@dev.local");
  await page.locator('input[name="password"]').fill("DevAdmin123!");
  await page.locator(".login-submit").click();
  await expect(page).toHaveURL(/dashboard/);
  await page.waitForLoadState("networkidle");
  for (const path of [
    "accounts",
    "users",
    "files",
    "search",
    "notifications",
    "profile",
  ]) {
    await page.goto("/" + path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});
