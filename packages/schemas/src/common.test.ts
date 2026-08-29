import { describe, expect, test } from "bun:test";
import { addMoney, moneySchema, negateMoney } from "./common";

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
