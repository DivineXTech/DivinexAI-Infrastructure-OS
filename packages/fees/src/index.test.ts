import { describe, expect, test } from "bun:test";
import type { Money } from "@divinexai/schemas";
import {
  StaticFeeScheduleSource,
  calculateFeeSplit,
  calculateWaterfallSplit,
  resolvePlatformFeeBps,
} from "./index";

/** The required audit test matrix, in minor units (cents). */
const AMOUNT_MATRIX_CENTS = [
  1, // $0.01
  5, // $0.05
  99, // $0.99
  100, // $1.00
  499, // $4.99
  500, // $5.00
  999, // $9.99
  1_000, // $10.00
  2_900, // $29.00
  9_900, // $99.00
  29_900, // $299.00
  100_000, // $1,000.00
  1_000_000, // $10,000.00
];

/** DMTV v1 launch plan rates, plus the Enterprise configurable 2-4% band. */
const RATE_MATRIX_BPS = {
  FREE: 1_000,
  PRO: 800,
  BUSINESS: 600,
  STUDIO: 400,
  "ENTERPRISE (2%)": 200,
  "ENTERPRISE (3%)": 300,
  "ENTERPRISE (4%)": 400,
} as const;

describe("resolvePlatformFeeBps", () => {
  test("resolves default rates per plan tier", async () => {
    const source = new StaticFeeScheduleSource();
    expect(await resolvePlatformFeeBps("FREE", "org1", source)).toBe(1_000);
    expect(await resolvePlatformFeeBps("PRO", "org1", source)).toBe(800);
    expect(await resolvePlatformFeeBps("BUSINESS", "org1", source)).toBe(600);
    expect(await resolvePlatformFeeBps("STUDIO", "org1", source)).toBe(400);
  });

  test("uses per-organization override when present", async () => {
    const source = new StaticFeeScheduleSource({ org1: 250 });
    expect(await resolvePlatformFeeBps("FREE", "org1", source)).toBe(250);
    expect(await resolvePlatformFeeBps("FREE", "org2", source)).toBe(1_000);
  });

  test("rejects an out-of-range override", async () => {
    const source = new StaticFeeScheduleSource({ org1: 20_000 });
    await expect(resolvePlatformFeeBps("FREE", "org1", source)).rejects.toThrow();
  });
});

describe("calculateFeeSplit", () => {
  test("splits gross into platform fee and creator net at 10%", () => {
    const result = calculateFeeSplit({ amountMinorUnits: 1_000, currency: "USD" }, 1_000);
    expect(result.platformFeeAmount).toEqual({ amountMinorUnits: 100, currency: "USD" });
    expect(result.creatorNetAmount).toEqual({ amountMinorUnits: 900, currency: "USD" });
  });

  test("rounds the platform fee down so the creator never loses a fractional unit", () => {
    const result = calculateFeeSplit({ amountMinorUnits: 999, currency: "USD" }, 1_000);
    expect(result.platformFeeAmount.amountMinorUnits).toBe(99);
    expect(result.creatorNetAmount.amountMinorUnits).toBe(900);
  });

  test("gross always equals fee + net", () => {
    for (const gross of [1, 7, 999, 123_456]) {
      for (const bps of [0, 400, 600, 800, 1_000, 10_000]) {
        const result = calculateFeeSplit({ amountMinorUnits: gross, currency: "USD" }, bps);
        expect(result.platformFeeAmount.amountMinorUnits + result.creatorNetAmount.amountMinorUnits).toBe(
          gross,
        );
      }
    }
  });

  test("rejects an out-of-range bps", () => {
    expect(() => calculateFeeSplit({ amountMinorUnits: 100, currency: "USD" }, -1)).toThrow();
    expect(() => calculateFeeSplit({ amountMinorUnits: 100, currency: "USD" }, 10_001)).toThrow();
  });

  test("documents the audited $4.99 @ FREE tier (10%) result: $0.49 fee / $4.50 net", () => {
    const result = calculateFeeSplit({ amountMinorUnits: 499, currency: "USD" }, RATE_MATRIX_BPS.FREE);
    expect(result.platformFeeAmount.amountMinorUnits).toBe(49);
    expect(result.creatorNetAmount.amountMinorUnits).toBe(450);
    // Not the naive round-half-up result ($0.50 / $4.49) -- see calculateFeeSplit's docblock.
    expect(result.platformFeeAmount.amountMinorUnits).not.toBe(50);
    expect(result.creatorNetAmount.amountMinorUnits).not.toBe(449);
  });

  describe("audit matrix: every required amount x every DMTV v1 rate", () => {
    for (const amountMinorUnits of AMOUNT_MATRIX_CENTS) {
      for (const [tierLabel, bps] of Object.entries(RATE_MATRIX_BPS)) {
        test(`$${(amountMinorUnits / 100).toFixed(2)} @ ${tierLabel}`, () => {
          const gross: Money = { amountMinorUnits, currency: "USD" };
          const result = calculateFeeSplit(gross, bps);

          // (5) The invariant: gross === platform_fee + creator_net, exactly.
          expect(result.platformFeeAmount.amountMinorUnits + result.creatorNetAmount.amountMinorUnits).toBe(
            amountMinorUnits,
          );

          // The platform never collects more than its exact advertised rate.
          // Compared via integer cross-multiplication (feeAmount * 10000 <=
          // amount * bps) rather than float division, so the check itself
          // can't be thrown off by floating-point representation error.
          expect(result.platformFeeAmount.amountMinorUnits * 10_000).toBeLessThanOrEqual(
            amountMinorUnits * bps,
          );

          // Nothing is negative.
          expect(result.platformFeeAmount.amountMinorUnits).toBeGreaterThanOrEqual(0);
          expect(result.creatorNetAmount.amountMinorUnits).toBeGreaterThanOrEqual(0);
        });
      }
    }
  });
});

describe("calculateWaterfallSplit", () => {
  test("with a single allocation, matches calculateFeeSplit exactly", () => {
    for (const amountMinorUnits of AMOUNT_MATRIX_CENTS) {
      for (const bps of Object.values(RATE_MATRIX_BPS)) {
        const gross: Money = { amountMinorUnits, currency: "USD" };
        const feeSplit = calculateFeeSplit(gross, bps);
        const waterfall = calculateWaterfallSplit(gross, [{ name: "platform_fee", bps }]);
        expect(waterfall.allocations[0]!.amount.amountMinorUnits).toBe(
          feeSplit.platformFeeAmount.amountMinorUnits,
        );
        expect(waterfall.residualAmount.amountMinorUnits).toBe(feeSplit.creatorNetAmount.amountMinorUnits);
      }
    }
  });

  test("preserves the invariant across multiple simultaneous allocations (Phase 2 shape: fee + processing + tax + partner)", () => {
    const allocations = [
      { name: "platform_fee", bps: 1_000 },
      { name: "processing_fee", bps: 290 },
      { name: "tax", bps: 875 },
      { name: "partner:acme", bps: 150 },
    ];
    for (const amountMinorUnits of AMOUNT_MATRIX_CENTS) {
      const gross: Money = { amountMinorUnits, currency: "USD" };
      const result = calculateWaterfallSplit(gross, allocations);
      const total = result.allocations.reduce(
        (sum, a) => sum + a.amount.amountMinorUnits,
        result.residualAmount.amountMinorUnits,
      );
      expect(total).toBe(amountMinorUnits);
      for (const allocation of result.allocations) {
        expect(allocation.amount.amountMinorUnits).toBeGreaterThanOrEqual(0);
      }
      expect(result.residualAmount.amountMinorUnits).toBeGreaterThanOrEqual(0);
    }
  });

  test("rejects allocations summing to more than 100%", () => {
    expect(() =>
      calculateWaterfallSplit({ amountMinorUnits: 1_000, currency: "USD" }, [
        { name: "a", bps: 6_000 },
        { name: "b", bps: 5_000 },
      ]),
    ).toThrow();
  });

  test("rejects an individual allocation out of range", () => {
    expect(() =>
      calculateWaterfallSplit({ amountMinorUnits: 1_000, currency: "USD" }, [{ name: "a", bps: -1 }]),
    ).toThrow();
  });

  test("an empty allocation list returns the full gross as residual", () => {
    const result = calculateWaterfallSplit({ amountMinorUnits: 12_345, currency: "USD" }, []);
    expect(result.allocations).toEqual([]);
    expect(result.residualAmount.amountMinorUnits).toBe(12_345);
  });
});
