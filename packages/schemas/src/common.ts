import { z } from "zod";

export const uuidSchema = z.string().uuid();

/** ISO 4217 currency code, e.g. "USD". */
export const currencyCodeSchema = z.string().length(3).toUpperCase();

/**
 * Money is always represented as integer minor units (e.g. cents) to avoid
 * floating point drift in financial calculations.
 */
export const moneySchema = z.object({
  amountMinorUnits: z.number().int(),
  currency: currencyCodeSchema,
});
export type Money = z.infer<typeof moneySchema>;

export const territoryCodeSchema = z.string().length(2).toUpperCase();
export const worldwideTerritorySchema = z.literal("WORLDWIDE");
export const territorySchema = z.union([territoryCodeSchema, worldwideTerritorySchema]);
export type Territory = z.infer<typeof territorySchema>;

export const creatorPlanTierSchema = z.enum([
  "FREE",
  "PRO",
  "BUSINESS",
  "STUDIO",
  "ENTERPRISE",
]);
export type CreatorPlanTier = z.infer<typeof creatorPlanTierSchema>;

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add money of different currencies: ${a.currency} vs ${b.currency}`);
  }
  return { amountMinorUnits: a.amountMinorUnits + b.amountMinorUnits, currency: a.currency };
}

export function negateMoney(a: Money): Money {
  return { amountMinorUnits: -a.amountMinorUnits, currency: a.currency };
}

const BPS_BASE = 10_000;

/**
 * Computes `floor(amountMinorUnits * bps / bpsBase)` using exact BigInt
 * integer arithmetic -- never the JS `/` operator on the product, which is
 * IEEE-754 binary floating-point and can misround money math (e.g.
 * `10_000` has no exact binary fraction, so `x / 10_000` is not guaranteed
 * bit-exact for every integer `x`). This is the ONLY sanctioned way to turn
 * a basis-point rate into a minor-unit amount anywhere in this codebase.
 *
 * Truncates toward zero, which for non-negative inputs is a floor. This is
 * a DEDUCTION helper (fees, tax, contributor shares taken out of a pool):
 * combined with computing the residual/net as `total - sum(deductions)`
 * (never as an independently-rounded percentage of its own), the two
 * always sum back to the original total exactly, by construction -- no
 * rounding remainder can ever be created or destroyed.
 */
export function floorBpsOf(amountMinorUnits: number, bps: number, bpsBase: number = BPS_BASE): number {
  if (!Number.isInteger(amountMinorUnits) || amountMinorUnits < 0) {
    throw new Error(`amountMinorUnits must be a non-negative integer, got ${amountMinorUnits}`);
  }
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`bps must be a non-negative integer, got ${bps}`);
  }
  if (!Number.isInteger(bpsBase) || bpsBase <= 0) {
    throw new Error(`bpsBase must be a positive integer, got ${bpsBase}`);
  }
  return Number((BigInt(amountMinorUnits) * BigInt(bps)) / BigInt(bpsBase));
}

/**
 * Parses a decimal amount string (e.g. a dollar amount typed into a form,
 * "4.99") into integer minor units (499) using string/BigInt arithmetic --
 * never `Number(input) * 10 ** decimalPlaces`, which routes a user-typed
 * decimal through binary floating-point multiplication before it ever
 * becomes an integer. This is the sanctioned boundary conversion from
 * "decimal string a human typed" to the internal integer representation.
 */
export function parseDecimalToMinorUnits(input: string, decimalPlaces = 2): number {
  const trimmed = input.trim();
  const pattern = new RegExp(`^(\\d+)(?:\\.(\\d{1,${decimalPlaces}}))?$`);
  const parts = pattern.exec(trimmed);
  if (!parts) {
    throw new Error(`Invalid decimal amount "${input}"; expected up to ${decimalPlaces} decimal places.`);
  }
  const wholePart = parts[1]!;
  const fractionPart = (parts[2] ?? "").padEnd(decimalPlaces, "0");
  return Number(BigInt(wholePart + fractionPart));
}
