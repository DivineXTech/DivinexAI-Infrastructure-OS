import { test, expect } from "@playwright/test";

// These assert the *shape* of the auth boundary — a signed-out visitor is
// bounced to /login with a redirect_to — independent of whether Supabase is
// configured. Full sign-in flows are covered in commerce-flows.spec.ts,
// which requires a connected Supabase project.
test.describe("protected route redirects", () => {
  const protectedPaths = ["/dashboard", "/admin", "/library", "/account", "/onboarding"];

  for (const path of protectedPaths) {
    test(`${path} redirects a signed-out visitor to /login`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("redirect_to")).toBe(path);
    });
  }

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("signup page renders the create-account form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });
});
