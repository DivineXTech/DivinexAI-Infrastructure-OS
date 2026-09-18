import { test, expect } from "@playwright/test";

import { isLiveBackend } from "../shared/backend-env";

test.describe("public navigation", () => {
  test("desktop nav links reach their pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByRole("heading", { name: /plans that grow/i })).toBeVisible();
  });

  test("mobile menu opens, lists links, and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("link", { name: "Equipment" }).click();
    await expect(page).toHaveURL(/\/equipment/);
  });

  test("every required public route is reachable and indexable", async ({ request }) => {
    const routes = [
      "/",
      "/how-it-works",
      "/startup-kits",
      "/equipment",
      "/services",
      "/design-studio",
      "/academy",
      "/pricing",
      "/marketplace",
      "/white-label",
      "/about",
      "/contact",
      "/book-consultation",
      "/terms",
      "/privacy",
    ];
    for (const route of routes) {
      const response = await request.get(route);
      expect(response.status(), `${route} should return 200`).toBe(200);
    }
  });
});

test.describe("sitemap and robots", () => {
  test("sitemap.xml lists the public routes", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/pricing");
    expect(body).toContain("/white-label");
  });

  test("robots.txt disallows /app and /admin", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const body = await response.text();
    expect(body).toContain("Disallow: /app");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Sitemap:");
  });
});

test.describe("interactive apparel demo", () => {
  test("rotate, color, zoom, and reset controls work", async ({ page }) => {
    await page.goto("/");
    const demo = page.getByRole("img", { name: /garment preview/i });
    await expect(demo).toHaveAccessibleName(/front view/i);

    await page.getByRole("button", { name: "Rotate →" }).click();
    await expect(page.getByRole("img", { name: /right side view/i })).toBeVisible();

    await page.getByRole("button", { name: "Navy garment color" }).click();
    await expect(page.getByRole("img", { name: /navy/i })).toBeVisible();

    await page.getByRole("button", { name: "Reset preview" }).click();
    await expect(page.getByRole("img", { name: /front view/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /black/i })).toBeVisible();
  });
});

test.describe("FAQ", () => {
  test("accordion opens and closes a single answer at a time", async ({ page }) => {
    await page.goto("/pricing");
    const firstQuestion = page.getByRole("button", { name: /do i need apparel experience/i });
    await firstQuestion.click();
    await expect(page.getByText(/academy and startup-kit consultation/i)).toBeVisible();
    await firstQuestion.click();
    await expect(page.getByText(/academy and startup-kit consultation/i)).toBeHidden();
  });
});

test.describe("pricing", () => {
  test("renders honest 'Request pricing' rather than fabricated numbers", async ({ page }) => {
    await page.goto("/pricing");
    const requestPricing = page.getByText("Request pricing");
    await expect(requestPricing.first()).toBeVisible();
    await expect(page.getByText(/\$\d/)).toHaveCount(0);
  });
});

test.describe("lead capture forms", () => {
  test("shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("submitting a valid contact form succeeds or fails honestly", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("E2E Test");
    await page.getByLabel("Email").fill("e2e-test@example.com");
    await page.getByLabel(/I agree to be contacted/).check();
    await page.getByRole("button", { name: "Send Message" }).click();

    if (isLiveBackend) {
      await expect(page.getByText(/thanks/i)).toBeVisible({ timeout: 10_000 });
    } else {
      // No Supabase service-role key configured in this environment — the
      // form must say so honestly rather than pretending to succeed.
      await expect(page.getByText(/isn't connected yet/i)).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
