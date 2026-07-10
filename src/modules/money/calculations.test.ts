import { describe, expect, it } from "vitest";
import {
  computeDiscount,
  computePlatformFee,
  computePriceBreakdown,
  clampPayWhatYouWant,
  computeAffiliateCommission,
} from "./calculations";

describe("computeDiscount", () => {
  it("returns 0 when there is no coupon", () => {
    expect(computeDiscount(10000, null)).toBe(0);
  });

  it("applies a percentage discount, rounded down", () => {
    expect(computeDiscount(9999, { discountType: "percentage", discountValue: 10 })).toBe(999);
  });

  it("caps a fixed discount at the subtotal", () => {
    expect(computeDiscount(500, { discountType: "fixed", discountValue: 10000 })).toBe(500);
  });
});

describe("computePlatformFee", () => {
  it("computes percentage plus fixed fee", () => {
    expect(computePlatformFee(10000, { percentageBps: 900, fixedFeeMinor: 50 })).toBe(950);
  });

  it("returns 0 fee on 0 amount with only a percentage rule", () => {
    expect(computePlatformFee(0, { percentageBps: 900, fixedFeeMinor: 0 })).toBe(0);
  });
});

describe("computePriceBreakdown", () => {
  const feeRule = { percentageBps: 900, fixedFeeMinor: 0 };

  it("computes a breakdown with no coupon", () => {
    const result = computePriceBreakdown({ subtotalMinor: 10000, coupon: null, feeRule });
    expect(result).toEqual({
      subtotalMinor: 10000,
      discountMinor: 0,
      platformFeeMinor: 900,
      taxMinor: 0,
      totalMinor: 10000,
      creatorNetMinor: 9100,
    });
  });

  it("applies the coupon before computing the platform fee", () => {
    const result = computePriceBreakdown({
      subtotalMinor: 10000,
      coupon: { discountType: "percentage", discountValue: 20 },
      feeRule,
    });
    // discounted subtotal = 8000; fee = 9% of 8000 = 720
    expect(result.discountMinor).toBe(2000);
    expect(result.platformFeeMinor).toBe(720);
    expect(result.totalMinor).toBe(8000);
    expect(result.creatorNetMinor).toBe(7280);
  });

  it("never produces a negative creator net", () => {
    const result = computePriceBreakdown({
      subtotalMinor: 100,
      coupon: null,
      feeRule: { percentageBps: 10000, fixedFeeMinor: 500 },
    });
    expect(result.creatorNetMinor).toBe(0);
  });

  it("throws on a negative subtotal", () => {
    expect(() => computePriceBreakdown({ subtotalMinor: -1, coupon: null, feeRule })).toThrow();
  });

  it("adds tax on top of the discounted subtotal", () => {
    const result = computePriceBreakdown({ subtotalMinor: 10000, coupon: null, feeRule, taxMinor: 750 });
    expect(result.totalMinor).toBe(10750);
  });
});

describe("clampPayWhatYouWant", () => {
  it("raises an amount below the minimum up to the minimum", () => {
    expect(clampPayWhatYouWant(200, 500)).toBe(500);
  });

  it("keeps an amount at or above the minimum unchanged", () => {
    expect(clampPayWhatYouWant(900, 500)).toBe(900);
  });
});

describe("computeAffiliateCommission", () => {
  it("computes a percentage commission", () => {
    expect(computeAffiliateCommission(10000, { type: "percentage", value: 15 })).toBe(1500);
  });

  it("caps a fixed commission at the base amount", () => {
    expect(computeAffiliateCommission(300, { type: "fixed", value: 1000 })).toBe(300);
  });
});
