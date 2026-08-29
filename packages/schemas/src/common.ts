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
