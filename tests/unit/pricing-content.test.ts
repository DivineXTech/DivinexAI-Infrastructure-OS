import { describe, expect, it } from "vitest";

import { PRICING_PLANS } from "@/lib/content/pricing";

describe("PRICING_PLANS", () => {
  it("has no fabricated pricing — every plan is startingAtCents: null", () => {
    // No approved pricing exists yet (see lib/content/pricing.ts header
    // comment). This test exists specifically to catch someone later
    // hardcoding a number here without updating this guard intentionally.
    for (const plan of PRICING_PLANS) {
      expect(plan.startingAtCents).toBeNull();
    }
  });

  it("gives every plan a non-empty name, description, and CTA", () => {
    for (const plan of PRICING_PLANS) {
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.description.length).toBeGreaterThan(0);
      expect(plan.cta.href.startsWith("/")).toBe(true);
    }
  });

  it("has unique plan slugs", () => {
    const slugs = PRICING_PLANS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
