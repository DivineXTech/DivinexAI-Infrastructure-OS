import { test, expect } from "@playwright/test";

test.describe("admin dashboard", () => {
  test("blocks unauthenticated access, then allows login and logout", async ({ page }) => {
    // Unauthenticated visit to a protected admin page redirects to login.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);

    // Wrong password is rejected.
    await page.getByPlaceholder("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid credentials.")).toBeVisible();

    // Correct password (set via ADMIN_PASSWORD in playwright.config.ts) succeeds.
    await page.getByPlaceholder("Password").fill("e2e-test-admin-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    // The dashboard nav reaches the other sections.
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: "Subscribers" }).click();
    await expect(page.getByRole("heading", { name: /Subscribers/ })).toBeVisible();

    await nav.getByRole("link", { name: "Rewards" }).click();
    await expect(page.getByRole("heading", { name: /Rewards/ })).toBeVisible();

    // Logging out revokes the session — a subsequent visit bounces to login.
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
