import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for Flow C (discover → mock checkout → order →
 * entitlement → protected download) from the product brief. Requires a
 * connected, migrated, and seeded Supabase project:
 *
 *   npm run db:migrate:local   # or apply supabase/migrations/*.sql to your project
 *   npm run seed
 *
 * and NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY set in the environment running the test. Skips
 * itself when Supabase isn't configured so `npm run test:e2e` still passes
 * in an unconfigured sandbox (see TESTING.md).
 */
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const DEMO_BUYER_EMAIL = "buyer.demo@flowramarket.africa";
const DEMO_PASSWORD = "FlowraDemo!2026";

test.describe("Flow C: discover, purchase, and download a free product", () => {
  test.skip(!supabaseConfigured, "Requires a connected, seeded Supabase project");

  test("buyer signs in, buys the free demo product, and reaches their library", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO_BUYER_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/);

    await page.goto("/product/social-media-content-automation-pack");
    await page.getByRole("link", { name: "Get it free" }).click();
    await expect(page).toHaveURL(/\/checkout\//);

    await page.getByRole("button", { name: "Get it free" }).click();
    await expect(page).toHaveURL(/\/checkout\/order\//);
    await expect(page.getByText("Purchase complete")).toBeVisible();

    await page.getByRole("link", { name: "Go to your library" }).click();
    await expect(page).toHaveURL("/library/purchases");
    await expect(page.getByText("Social Media Content Automation Pack")).toBeVisible();
  });
});
