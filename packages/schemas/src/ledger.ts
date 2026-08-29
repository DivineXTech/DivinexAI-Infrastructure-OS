import { z } from "zod";
import { moneySchema, uuidSchema } from "./common";

export const ledgerEntryTypeSchema = z.enum([
  "SALE_GROSS",
  "PLATFORM_FEE",
  "CREATOR_NET",
  "CONTRIBUTOR_SPLIT",
  "PAYOUT",
  "REFUND",
  "COMPENSATING",
]);
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

export const ledgerAccountTypeSchema = z.enum([
  "PLATFORM_REVENUE",
  "CREATOR_BALANCE",
  "CONTRIBUTOR_BALANCE",
  "FAN_PAYMENT_CLEARING",
  "PAYOUT_CLEARING",
]);
export type LedgerAccountType = z.infer<typeof ledgerAccountTypeSchema>;

/**
 * A single leg of a double-entry ledger transaction. Every transaction is a
 * balanced set of entries (debits sum to credits) grouped by transactionId.
 * Ledger rows are append-only: corrections are made with COMPENSATING
 * entries referencing reversalOfEntryId, never by editing a row in place.
 */
export const ledgerEntrySchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  transactionId: uuidSchema,
  orderId: uuidSchema.nullable().default(null),
  accountType: ledgerAccountTypeSchema,
  accountRefId: uuidSchema,
  entryType: ledgerEntryTypeSchema,
  direction: z.enum(["DEBIT", "CREDIT"]),
  amount: moneySchema,
  reversalOfEntryId: uuidSchema.nullable().default(null),
  idempotencyKey: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const feeScheduleSchema = z.object({
  planTier: z.enum(["FREE", "PRO", "BUSINESS", "STUDIO", "ENTERPRISE"]),
  platformFeeBps: z.number().int().min(0).max(10_000),
  effectiveFrom: z.string().datetime(),
});
export type FeeSchedule = z.infer<typeof feeScheduleSchema>;

export const payoutStatusSchema = z.enum([
  "REQUESTED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELED",
]);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const payoutSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  creatorId: uuidSchema,
  amount: moneySchema,
  status: payoutStatusSchema,
  flowraPayPayoutId: z.string().nullable().default(null),
  idempotencyKey: z.string().min(1).max(200),
  requestedAt: z.string().datetime(),
  settledAt: z.string().datetime().nullable().default(null),
});
export type Payout = z.infer<typeof payoutSchema>;
