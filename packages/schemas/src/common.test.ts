import { describe, expect, test } from "bun:test";
import { addMoney, floorBpsOf, moneySchema, negateMoney, parseDecimalToMinorUnits } from "./common";

describe("money", () => {
  test("adds money of the same currency", () => {
    const a = { amountMinorUnits: 100, currency: "USD" };
    const b = { amountMinorUnits: 250, currency: "USD" };
    expect(addMoney(a, b)).toEqual({ amountMinorUnits: 350, currency: "USD" });
  });

  test("throws when adding different currencies", () => {
    const a = { amountMinorUnits: 100, currency: "USD" };
    const b = { amountMinorUnits: 250, currency: "EUR" };
    expect(() => addMoney(a, b)).toThrow();
  });

  test("negates money", () => {
    expect(negateMoney({ amountMinorUnits: 500, currency: "USD" })).toEqual({
      amountMinorUnits: -500,
      currency: "USD",
    });
  });

  test("validates money schema", () => {
    expect(moneySchema.safeParse({ amountMinorUnits: 100, currency: "usd" }).success).toBe(true);
    expect(moneySchema.safeParse({ amountMinorUnits: 1.5, currency: "USD" }).success).toBe(false);
  });
});

describe("floorBpsOf", () => {
  test("matches exact integer math for the reported $4.99 @ 10% case", () => {
    // 499 * 1000 / 10000 = 49.9 -> floors to 49 cents, never 50.
    expect(floorBpsOf(499, 1_000)).toBe(49);
  });

  test("never rounds up, even when float division would misround near a boundary", () => {
    // 10_000 has no exact binary fraction; verify a large sweep against the
    // exact BigInt-derived expectation rather than trusting `Math.floor(a/b)`.
    for (let cents = 0; cents <= 100_000; cents += 37) {
      for (const bps of [1_000, 800, 600, 400, 250, 9_999]) {
        const expected = Number((BigInt(cents) * BigInt(bps)) / 10_000n);
        expect(floorBpsOf(cents, bps)).toBe(expected);
      }
    }
  });

  test("rejects non-integer or negative inputs", () => {
    expect(() => floorBpsOf(1.5, 1_000)).toThrow();
    expect(() => floorBpsOf(-1, 1_000)).toThrow();
    expect(() => floorBpsOf(100, -1)).toThrow();
  });

  test("supports an arbitrary base for non-bps percentage math", () => {
    expect(floorBpsOf(100, 33, 100)).toBe(33);
  });
});

describe("parseDecimalToMinorUnits", () => {
  test("parses whole and fractional dollar strings without float arithmetic", () => {
    expect(parseDecimalToMinorUnits("4.99")).toBe(499);
    expect(parseDecimalToMinorUnits("0.01")).toBe(1);
    expect(parseDecimalToMinorUnits("10000")).toBe(1_000_000);
    expect(parseDecimalToMinorUnits("10000.00")).toBe(1_000_000);
    expect(parseDecimalToMinorUnits("29")).toBe(2_900);
  });

  test("pads a short fractional part", () => {
    expect(parseDecimalToMinorUnits("4.9")).toBe(490);
    expect(parseDecimalToMinorUnits("4")).toBe(400);
  });

  test("rejects malformed or over-precise input", () => {
    expect(() => parseDecimalToMinorUnits("4.999")).toThrow();
    expect(() => parseDecimalToMinorUnits("abc")).toThrow();
    expect(() => parseDecimalToMinorUnits("-4.99")).toThrow();
    expect(() => parseDecimalToMinorUnits("")).toThrow();
  });

  test("agrees with a naive float parse for a full sweep of cent values (and never depends on doing so)", () => {
    // Spot-check against Number.parseFloat purely as a sanity cross-check;
    // parseDecimalToMinorUnits itself never performs this float step.
    for (let cents = 0; cents <= 999_999; cents += 101) {
      const dollars = cents / 100;
      const input = dollars.toFixed(2);
      expect(parseDecimalToMinorUnits(input)).toBe(Math.round(Number.parseFloat(input) * 100));
    }
  });
});
