import { test, expect } from "@playwright/test";

test.describe("join flow", () => {
  test("submit is disabled until all supporter actions are confirmed, then completes signup", async ({
    page,
  }) => {
    const uniqueEmail = `e2e-${Date.now()}@example.com`;

    await page.goto("/join");

    const submitButton = page.getByRole("button", { name: /Join the Waitlist/i });
    await expect(submitButton).toBeDisabled();

    await page.getByLabel("I've completed this action").nth(0).check();
    await page.getByLabel("I've completed this action").nth(1).check();
    await expect(submitButton).toBeDisabled();
    await page.getByLabel("I've completed this action").nth(2).check();

    await expect(submitButton).toBeEnabled();

    await page.getByLabel("First name").fill("Playwright");
    await page.getByLabel("Email address").fill(uniqueEmail);
    await page.getByLabel(/I accept the/).check();

    // The form has a minimum-fill-time bot heuristic (server-side); a real
    // visitor takes longer than this to reach submit anyway.
    await page.waitForTimeout(1500);
    await submitButton.click();

    await expect(page).toHaveURL(/\/thank-you\?/);
    await expect(page.getByRole("heading", { name: /Welcome to the waitlist, Playwright/i })).toBeVisible();
    await expect(page.getByText("Your referral link")).toBeVisible();
  });
});
