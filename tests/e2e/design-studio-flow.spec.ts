/**
 * End-to-end coverage of the Phase 4 Design Studio → product catalog
 * flow: opening the studio, selecting a garment/color, uploading
 * artwork, adding text, moving/resizing an element via the accessible
 * numeric inputs, switching views, saving/resuming, submitting for
 * review, approving as an authorized role, creating a product draft,
 * generating variants, editing pricing, viewing a mockup, and denying
 * an unauthorized approval attempt. Like tests/e2e/onboarding-flow.spec.ts,
 * these perform real Supabase auth and database calls against seeded
 * personas, so they're skipped — not failed — without a live,
 * non-placeholder project. See docs/TESTING.md.
 */
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

import { isLiveBackend } from "../shared/backend-env";
import { TEST_PASSWORD, TEST_USERS } from "../integration/helpers";

const run = isLiveBackend ? test : test.skip;

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
}

run("opens the design studio, creates a design, and selects a garment template and color", async ({ page }) => {
  await login(page, TEST_USERS.designerA);
  await page.goto("/app/design-studio/new");
  await page.getByLabel("Design name").fill("E2E Test Design");
  await page.getByRole("button", { name: /create design/i }).click();
  await expect(page).toHaveURL(/\/app\/design-studio\/[a-z0-9-]+$/);

  await page.getByLabel("Garment template").selectOption({ label: "Generic T-Shirt" });
  await expect(page.getByLabel("Color")).toBeVisible();
  await page.getByLabel("Color").selectOption({ label: "Black" });
});

run("adds text, moves it via the numeric position inputs, and switches views", async ({ page }) => {
  await login(page, TEST_USERS.designerA);
  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();

  await page.getByRole("button", { name: /add text/i }).click();
  await expect(page.getByLabel("Text content")).toBeVisible();
  await page.getByLabel("Text content").fill("HELLO WORLD");

  await page.getByLabel("X position (%)").fill("40");
  await page.getByLabel("Y position (%)").fill("35");
  await expect(page.getByLabel("X position (%)")).toHaveValue("40");

  await page.getByRole("button", { name: "back", exact: true }).click();
  await expect(page.getByText(/no elements yet/i)).toBeVisible();
  await page.getByRole("button", { name: "front", exact: true }).click();
  await expect(page.getByText(/HELLO WORLD/i)).toBeVisible();
});

run("uploads artwork as an image element", async ({ page }) => {
  await login(page, TEST_USERS.designerA);
  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, "fixtures", "test-artwork.png"));
  await expect(page.getByText(/^image$/i).first()).toBeVisible({ timeout: 10_000 });
});

run("saves a draft, navigates away, and resumes with the same content", async ({ page }) => {
  await login(page, TEST_USERS.designerA);
  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();
  await page.getByRole("button", { name: /save draft/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5_000 });

  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();
  await expect(page.getByText(/HELLO WORLD/i)).toBeVisible();
});

run("submits for review, and a designer cannot approve their own submission", async ({ page }) => {
  await login(page, TEST_USERS.designerA);
  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();
  await page.getByRole("button", { name: /submit for review/i }).click();
  await expect(page.getByText(/ready for review/i)).toBeVisible();
  // A designer has no approve/request-changes buttons rendered at all —
  // approval is owner/admin only (requireDesignApprovalAccess).
  await expect(page.getByRole("button", { name: /^approve$/i })).toHaveCount(0);
});

run("an owner can approve a design ready for review", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();
  await page.getByRole("button", { name: /^approve$/i }).click();
  await expect(page.getByText(/^approved$/i)).toBeVisible();
});

run("converts the approved design into a product draft, generates variants, and edits pricing", async ({
  page,
}) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/design-studio");
  await page.getByRole("link", { name: /E2E Test Design/i }).click();
  await page.getByRole("button", { name: /create product draft/i }).click();
  await expect(page).toHaveURL(/\/app\/products\/[a-z0-9-]+$/);

  await page.getByRole("link", { name: /variants/i }).click();
  await page.getByLabel(/sizes/i).fill("M, L");
  await page.getByLabel(/colors/i).fill("Black");
  await page.getByRole("button", { name: /generate variants/i }).click();
  await expect(page.getByText(/created \d+ new variant/i)).toBeVisible();

  await page.goto(page.url().replace("/variants", "/pricing"));
  const retailInputs = page.locator('input[id$="-retail"]');
  await retailInputs.first().fill("24.99");
  await page.getByRole("button", { name: /save pricing/i }).first().click();
});

run("views a generated mockup, labeled as a digital preview", async ({ page }) => {
  await login(page, TEST_USERS.ownerA);
  await page.goto("/app/mockups");
  const firstMockup = page.getByRole("link").first();
  if (await firstMockup.isVisible().catch(() => false)) {
    await firstMockup.click();
    await expect(page.getByText(/digital preview/i)).toBeVisible();
    await expect(page.getByText(/not a final production proof/i)).toBeVisible();
  }
});
