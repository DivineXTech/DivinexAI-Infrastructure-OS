import type { LedgerAccountType, LedgerEntry, LedgerEntryType, Money } from "@divinexai/schemas";
import type { FeeSplitResult } from "@divinexai/fees";

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "createdAt">;

export interface ContributorShare {
  /** The contributor's payable identity. Defaults to the creator when a contributor has no linked user account. */
  accountRefId: string;
  amountMinorUnits: number;
}

/**
 * Ledger is append-only. Corrections happen via compensating entries that
 * reference the entry they reverse (`reversalOfEntryId`) — a completed
 * financial record is never edited or deleted in place.
 */
export interface LedgerStore {
  /** Returns true if a transaction with this idempotency key has already been recorded. */
  hasIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<boolean>;
  /** Atomically appends a balanced set of entries sharing one transactionId. */
  appendTransaction(entries: NewLedgerEntry[]): Promise<LedgerEntry[]>;
  getEntriesForAccount(
    organizationId: string,
    accountType: LedgerAccountType,
    accountRefId: string,
  ): Promise<LedgerEntry[]>;
}

/** Every transaction must debit and credit equal amounts, per currency. */
export function assertBalanced(entries: NewLedgerEntry[]): void {
  const totalsByCurrency = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) {
    const totals = totalsByCurrency.get(entry.amount.currency) ?? { debit: 0, credit: 0 };
    if (entry.direction === "DEBIT") {
      totals.debit += entry.amount.amountMinorUnits;
    } else {
      totals.credit += entry.amount.amountMinorUnits;
    }
    totalsByCurrency.set(entry.amount.currency, totals);
  }
  for (const [currency, totals] of totalsByCurrency) {
    if (totals.debit !== totals.credit) {
      throw new Error(
        `Unbalanced ledger transaction in ${currency}: debits=${totals.debit} credits=${totals.credit}`,
      );
    }
  }
}

export interface BuildSaleLedgerEntriesInput {
  organizationId: string;
  transactionId: string;
  orderId: string;
  fanId: string;
  creatorId: string;
  feeSplit: FeeSplitResult;
  /** Splits for contributors other than the creator themselves; the remainder stays with the creator. */
  contributorShares: ContributorShare[];
  idempotencyKey: string;
}

/**
 * Builds the balanced ledger entries for one completed sale: gross clears
 * from the fan, the platform takes its fee, and the remainder lands on the
 * creator's balance before being redistributed to any other contributors.
 */
export function buildSaleLedgerEntries(input: BuildSaleLedgerEntriesInput): NewLedgerEntry[] {
  const { organizationId, transactionId, orderId, fanId, creatorId, feeSplit, contributorShares, idempotencyKey } =
    input;
  const currency = feeSplit.grossAmount.currency;
  const money = (amountMinorUnits: number): Money => ({ amountMinorUnits, currency });

  const entries: NewLedgerEntry[] = [
    entry({
      organizationId,
      transactionId,
      orderId,
      accountType: "FAN_PAYMENT_CLEARING",
      accountRefId: fanId,
      entryType: "SALE_GROSS",
      direction: "DEBIT",
      amount: feeSplit.grossAmount,
      idempotencyKey,
    }),
    entry({
      organizationId,
      transactionId,
      orderId,
      accountType: "PLATFORM_REVENUE",
      accountRefId: organizationId,
      entryType: "PLATFORM_FEE",
      direction: "CREDIT",
      amount: feeSplit.platformFeeAmount,
      idempotencyKey,
    }),
    entry({
      organizationId,
      transactionId,
      orderId,
      accountType: "CREATOR_BALANCE",
      accountRefId: creatorId,
      entryType: "CREATOR_NET",
      direction: "CREDIT",
      amount: feeSplit.creatorNetAmount,
      idempotencyKey,
    }),
  ];

  const contributorTotal = contributorShares.reduce((sum, share) => sum + share.amountMinorUnits, 0);
  if (contributorTotal > feeSplit.creatorNetAmount.amountMinorUnits) {
    throw new Error(
      `Contributor shares (${contributorTotal}) exceed creator net (${feeSplit.creatorNetAmount.amountMinorUnits})`,
    );
  }

  for (const share of contributorShares) {
    if (share.amountMinorUnits === 0) continue;
    entries.push(
      entry({
        organizationId,
        transactionId,
        orderId,
        accountType: "CREATOR_BALANCE",
        accountRefId: creatorId,
        entryType: "CONTRIBUTOR_SPLIT",
        direction: "DEBIT",
        amount: money(share.amountMinorUnits),
        idempotencyKey,
      }),
      entry({
        organizationId,
        transactionId,
        orderId,
        accountType: "CONTRIBUTOR_BALANCE",
        accountRefId: share.accountRefId,
        entryType: "CONTRIBUTOR_SPLIT",
        direction: "CREDIT",
        amount: money(share.amountMinorUnits),
        idempotencyKey,
      }),
    );
  }

  assertBalanced(entries);
  return entries;
}

export interface BuildPayoutLedgerEntriesInput {
  organizationId: string;
  transactionId: string;
  creatorId: string;
  amount: Money;
  idempotencyKey: string;
}

export function buildPayoutLedgerEntries(input: BuildPayoutLedgerEntriesInput): NewLedgerEntry[] {
  const { organizationId, transactionId, creatorId, amount, idempotencyKey } = input;
  const entries: NewLedgerEntry[] = [
    entry({
      organizationId,
      transactionId,
      orderId: null,
      accountType: "CREATOR_BALANCE",
      accountRefId: creatorId,
      entryType: "PAYOUT",
      direction: "DEBIT",
      amount,
      idempotencyKey,
    }),
    entry({
      organizationId,
      transactionId,
      orderId: null,
      accountType: "PAYOUT_CLEARING",
      accountRefId: creatorId,
      entryType: "PAYOUT",
      direction: "CREDIT",
      amount,
      idempotencyKey,
    }),
  ];
  assertBalanced(entries);
  return entries;
}

/**
 * Builds compensating (reversal) entries for a prior balanced transaction.
 * Never mutates or deletes the originals; this is how refunds and
 * corrections are recorded.
 */
export function buildCompensatingEntries(
  originalEntries: LedgerEntry[],
  transactionId: string,
  idempotencyKey: string,
): NewLedgerEntry[] {
  const entries = originalEntries.map((original) =>
    entry({
      organizationId: original.organizationId,
      transactionId,
      orderId: original.orderId,
      accountType: original.accountType,
      accountRefId: original.accountRefId,
      entryType: "COMPENSATING" as LedgerEntryType,
      direction: original.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: original.amount,
      reversalOfEntryId: original.id,
      idempotencyKey,
    }),
  );
  assertBalanced(entries);
  return entries;
}

/** Balance = sum(credits) - sum(debits) for the account's entries. Throws on mixed currencies. */
export function computeAccountBalance(entries: LedgerEntry[]): Money {
  if (entries.length === 0) return { amountMinorUnits: 0, currency: "USD" };
  const currency = entries[0]!.amount.currency;
  let total = 0;
  for (const entry of entries) {
    if (entry.amount.currency !== currency) {
      throw new Error(`Mixed currencies in account balance: ${currency} vs ${entry.amount.currency}`);
    }
    total += entry.direction === "CREDIT" ? entry.amount.amountMinorUnits : -entry.amount.amountMinorUnits;
  }
  return { amountMinorUnits: total, currency };
}

function entry(fields: {
  organizationId: string;
  transactionId: string;
  orderId: string | null;
  accountType: LedgerAccountType;
  accountRefId: string;
  entryType: LedgerEntryType;
  direction: "DEBIT" | "CREDIT";
  amount: Money;
  idempotencyKey: string;
  reversalOfEntryId?: string | null;
}): NewLedgerEntry {
  return {
    organizationId: fields.organizationId,
    transactionId: fields.transactionId,
    orderId: fields.orderId,
    accountType: fields.accountType,
    accountRefId: fields.accountRefId,
    entryType: fields.entryType,
    direction: fields.direction,
    amount: fields.amount,
    reversalOfEntryId: fields.reversalOfEntryId ?? null,
    idempotencyKey: fields.idempotencyKey,
  };
}
