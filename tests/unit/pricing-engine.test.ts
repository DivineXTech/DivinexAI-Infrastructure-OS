import { describe, expect, it } from "vitest";

import {
  calculatePricing,
  calculateProfitAndMargin,
  calculateTotalUnitCost,
  suggestPriceCents,
  type PricingRule,
} from "@/lib/catalog/pricing-engine";

describe("calculateTotalUnitCost", () => {
  it("sums every provided cost component", () => {
    expect(
      calculateTotalUnitCost({ blank_garment: 500, printing: 300, packaging: 50 }),
    ).toBe(850);
  });

  it("treats missing components as zero", () => {
    expect(calculateTotalUnitCost({})).toBe(0);
  });
});

describe("calculateProfitAndMargin", () => {
  it("computes profit and margin percentage relative to price", () => {
    const result = calculateProfitAndMargin(2000, 800);
    expect(result.profitCents).toBe(1200);
    expect(result.marginPercent).toBe(60);
  });

  it("never divides by zero — a zero or negative price yields 0 margin, not NaN/Infinity", () => {
    expect(calculateProfitAndMargin(0, 500).marginPercent).toBe(0);
    expect(Number.isFinite(calculateProfitAndMargin(0, 500).marginPercent)).toBe(true);
  });
});

describe("suggestPriceCents", () => {
  it("fixed_markup adds a flat amount to cost", () => {
    const rule: PricingRule = { type: "fixed_markup", markupCents: 1000 };
    expect(suggestPriceCents(rule, 500)).toBe(1500);
  });

  it("target_margin solves for the price that yields the target margin", () => {
    const rule: PricingRule = { type: "target_margin", targetMarginPercent: 50 };
    const price = suggestPriceCents(rule, 1000);
    expect(price).toBe(2000);
    expect(calculateProfitAndMargin(price, 1000).marginPercent).toBeCloseTo(50, 0);
  });

  it("tiered_quantity_markup applies the highest tier the quantity qualifies for", () => {
    const rule: PricingRule = {
      type: "tiered_quantity_markup",
      quantity: 50,
      tiers: [
        { minQuantity: 0, markupMultiplier: 3 },
        { minQuantity: 25, markupMultiplier: 2.5 },
        { minQuantity: 100, markupMultiplier: 2 },
      ],
    };
    expect(suggestPriceCents(rule, 1000)).toBe(2500);
  });

  it("tiered_quantity_markup falls back to the lowest tier below every threshold", () => {
    const rule: PricingRule = {
      type: "tiered_quantity_markup",
      quantity: 1,
      tiers: [
        { minQuantity: 10, markupMultiplier: 2 },
        { minQuantity: 50, markupMultiplier: 1.5 },
      ],
    };
    expect(suggestPriceCents(rule, 1000)).toBe(2000);
  });

  it("manual returns exactly the manually-entered price, no calculation", () => {
    const rule: PricingRule = { type: "manual", manualPriceCents: 1999 };
    expect(suggestPriceCents(rule, 500)).toBe(1999);
  });

  it("is deterministic across repeated calls with identical input", () => {
    const rule: PricingRule = { type: "target_margin", targetMarginPercent: 40 };
    expect(suggestPriceCents(rule, 733)).toBe(suggestPriceCents(rule, 733));
  });
});

describe("calculatePricing", () => {
  it("computes total cost, retail margin, wholesale margin, and always discloses the planning-guidance caveat", () => {
    const result = calculatePricing({
      costComponents: { blank_garment: 500, printing: 200 },
      retailPriceCents: 2000,
      wholesalePriceCents: 1200,
    });
    expect(result.totalUnitCostCents).toBe(700);
    expect(result.grossProfitCents).toBe(1300);
    expect(result.grossMarginPercent).toBe(65);
    expect(result.wholesaleProfitCents).toBe(500);
    expect(result.explanation.some((line) => /not a guarantee of profitability/i.test(line))).toBe(true);
  });

  it("computes a break-even quantity only when fixed overhead and positive retail profit are both present", () => {
    const withOverhead = calculatePricing({
      costComponents: { blank_garment: 500 },
      retailPriceCents: 1500,
      wholesalePriceCents: null,
      fixedOverheadCents: 10000,
    });
    expect(withOverhead.breakEvenQuantity).toBe(Math.ceil(10000 / 1000));

    const withoutOverhead = calculatePricing({
      costComponents: { blank_garment: 500 },
      retailPriceCents: 1500,
      wholesalePriceCents: null,
    });
    expect(withoutOverhead.breakEvenQuantity).toBeNull();
  });

  it("leaves margin fields null when no price is set for that channel", () => {
    const result = calculatePricing({
      costComponents: { blank_garment: 500 },
      retailPriceCents: null,
      wholesalePriceCents: null,
    });
    expect(result.grossMarginPercent).toBeNull();
    expect(result.wholesaleMarginPercent).toBeNull();
  });
});
