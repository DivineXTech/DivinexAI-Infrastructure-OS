import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the hero, primary CTA, and legal footer links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Billionaire Blueprint/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Join the Waitlist" }).first()).toBeVisible();

    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Terms of Use" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Early-Access Terms" })).toBeVisible();
  });

  test("has no horizontal overflow on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
