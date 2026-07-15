import { test, expect } from "@playwright/test";

test("homepage renders the primary value proposition and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /launch your clothing brand/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Your Brand" }).first()).toBeVisible();
});

test("unauthenticated visitors are redirected away from /app", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated visitors are redirected away from /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("login page renders the login form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
