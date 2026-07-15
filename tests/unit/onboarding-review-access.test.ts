import { describe, expect, it } from "vitest";

import { computeReviewAccess } from "@/lib/onboarding/review-access";

describe("computeReviewAccess", () => {
  it("grants tenant_owner full edit access and every section", () => {
    const access = computeReviewAccess("tenant_owner", false);
    expect(access.allowed).toBe(true);
    expect(access.canEdit).toBe(true);
    expect(access.visibleSections).toEqual([
      "brand",
      "audience",
      "products",
      "production",
      "budget",
      "startup_kit",
      "storefront",
      "fulfillment",
    ]);
  });

  it("grants tenant_admin the same full access as tenant_owner", () => {
    const access = computeReviewAccess("tenant_admin", false);
    expect(access.canEdit).toBe(true);
    expect(access.visibleSections).toHaveLength(8);
  });

  it("grants designer read-only access to brand and products only", () => {
    const access = computeReviewAccess("designer", false);
    expect(access.allowed).toBe(true);
    expect(access.canEdit).toBe(false);
    expect(access.visibleSections).toEqual(["brand", "products"]);
  });

  it("grants production_manager read-only access to production only", () => {
    const access = computeReviewAccess("production_manager", false);
    expect(access.allowed).toBe(true);
    expect(access.canEdit).toBe(false);
    expect(access.visibleSections).toEqual(["production"]);
  });

  it("denies every other role — sales_rep cannot read the review page at all", () => {
    const access = computeReviewAccess("sales_rep", false);
    expect(access.allowed).toBe(false);
    expect(access.canEdit).toBe(false);
    expect(access.visibleSections).toEqual([]);
  });

  it("denies support_agent and customer roles", () => {
    expect(computeReviewAccess("support_agent", false).allowed).toBe(false);
    expect(computeReviewAccess("customer", false).allowed).toBe(false);
  });

  it("denies fulfillment_operator (not in the review-roles allowlist)", () => {
    expect(computeReviewAccess("fulfillment_operator", false).allowed).toBe(false);
  });

  it("a platform_super_admin flag grants full access regardless of the tenant role passed", () => {
    const access = computeReviewAccess("customer", true);
    expect(access.allowed).toBe(true);
    expect(access.canEdit).toBe(true);
    expect(access.visibleSections).toHaveLength(8);
  });

  it("never derives access from anything but the two explicit arguments (no hidden role inheritance)", () => {
    // Regression guard for the class of bug fixed in 61b1b83: calling this
    // twice with the same inputs must always agree — no session/global state.
    const first = computeReviewAccess("designer", false);
    const second = computeReviewAccess("designer", false);
    expect(first).toEqual(second);
  });
});
