import { test, expect } from "@playwright/test";

test.describe("public marketplace shell", () => {
  test("homepage renders the hero and nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Create it\. Sell it\. Scale it\./i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start selling" }).first()).toBeVisible();
  });

  test("discover page renders without crashing", async ({ page }) => {
    const response = await page.goto("/discover");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  });

  test("sell page explains the value proposition", async ({ page }) => {
    await page.goto("/sell");
    await expect(page.getByText("Turn African creativity, expertise, and innovation into global income.")).toBeVisible();
  });

  test("legal pages render placeholder content with a review notice", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByText(/not legal advice/i)).toBeVisible();
  });

  test("unknown legal document 404s", async ({ page }) => {
    const response = await page.goto("/legal/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
