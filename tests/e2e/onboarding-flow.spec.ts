/**
 * End-to-end coverage of the Phase 3 onboarding wizard: starting, saving
 * and continuing through steps, save-and-exit, resume, editing a prior
 * step, the startup-kit recommendation, completion, the dashboard
 * reflecting completion, and a non-edit role being denied the wizard.
 * Like tests/e2e/auth-flow.spec.ts, these perform real Supabase auth and
 * database calls against seeded personas, so they're skipped — not
 * failed — without a live, non-placeholder project. See docs/TESTING.md.
 */
import { test, expect, type Page } from "@playwright/test";

import { isLiveBackend } from "../shared/backend-env";
import { TEST_PASSWORD, TEST_USERS } from "../integration/helpers";

const run = isLiveBackend ? test : test.skip;

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
}

run("owner can start onboarding, save and continue through the welcome and brand steps", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/onboarding/welcome");
  await expect(page.getByRole("heading", { name: /set up your brand/i })).toBeVisible();

  await page.getByRole("button", { name: /get started/i }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/brand/);

  await page.getByLabel("Brand name").fill("Playwright Test Brand");
  await page.getByRole("button", { name: /save and continue/i }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/audience/);
});

run("save and exit returns to the dashboard, and resuming continues from the same step", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/onboarding/audience");

  await page.getByLabel("Schools").check();
  await page.getByRole("button", { name: /save and exit/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/onboarding is \d+% complete/i)).toBeVisible();

  await page.getByRole("link", { name: /resume onboarding/i }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/products/);
});

run("a completed step stays editable — going back to brand and changing it saves the edit", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/onboarding/brand");
  await expect(page.getByLabel("Brand name")).toHaveValue("Playwright Test Brand");

  await page.getByLabel("Brand name").fill("Playwright Test Brand (edited)");
  await page.getByRole("button", { name: /save and continue/i }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/audience/);

  await page.goto("/app/onboarding/brand");
  await expect(page.getByLabel("Brand name")).toHaveValue("Playwright Test Brand (edited)");
});

run("a locked, not-yet-reached step redirects back to the founder's current step instead of rendering", async ({
  page,
}) => {
  await login(page, TEST_USERS.ownerA);
  // Fulfillment is several steps ahead of wherever this seeded persona has
  // actually reached — the guard must redirect, never render the form.
  await page.goto("/app/onboarding/fulfillment");
  await expect(page).not.toHaveURL(/\/app\/onboarding\/fulfillment/);
});

run("the startup-kit step shows a generated recommendation with a risk disclosure", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/onboarding/startup-kit");

  const generateButton = page.getByRole("button", { name: /generate my recommendation/i });
  if (await generateButton.isVisible().catch(() => false)) {
    await generateButton.click();
  }
  await expect(page.getByText(/not a guarantee of business results/i)).toBeVisible({ timeout: 10_000 });
});

run("a designer is denied the edit wizard and sees read-only, scoped access on the review page", async ({
  page,
}) => {
  await login(page, TEST_USERS.designerA);
  await page.goto("/app/onboarding/brand");
  // Guard redirects non-edit roles away from the edit wizard entirely.
  await expect(page).not.toHaveURL(/\/app\/onboarding\/brand$/);

  await page.goto("/app/onboarding/review");
  await expect(page.getByText(/read-only access to this review/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /brand identity/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /budget/i })).not.toBeVisible();
});

run("completing onboarding lands on the completion page and the dashboard reflects it", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/onboarding/review");

  const completeButton = page.getByRole("button", { name: /complete onboarding/i });
  if (await completeButton.isVisible().catch(() => false)) {
    await completeButton.click();
    await expect(page).toHaveURL(/\/app\/onboarding\/complete/);
    await expect(page.getByRole("heading", { name: /onboarding complete/i })).toBeVisible();
  }

  await page.goto("/app");
  await expect(page.getByRole("link", { name: /review setup/i })).toBeVisible();
});
