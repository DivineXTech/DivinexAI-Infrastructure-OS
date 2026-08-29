import { describe, expect, test } from "bun:test";
import {
  StaticFeeScheduleSource,
  calculateFeeSplit,
  resolvePlatformFeeBps,
} from "./index";

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
});
