import { describe, expect, test } from "bun:test";
import { calculateFeeSplit } from "@divinexai/fees";
import {
  assertBalanced,
  buildCompensatingEntries,
  buildPayoutLedgerEntries,
  buildSaleLedgerEntries,
  computeAccountBalance,
} from "./index";
import type { LedgerEntry } from "@divinexai/schemas";

function withIds(entries: ReturnType<typeof buildSaleLedgerEntries>): LedgerEntry[] {
  return entries.map((e, i) => ({ ...e, id: `entry-${i}`, createdAt: new Date().toISOString() }));
}

describe("buildSaleLedgerEntries", () => {
  test("produces a balanced transaction with no other contributors", () => {
    const feeSplit = calculateFeeSplit({ amountMinorUnits: 1_000, currency: "USD" }, 1_000);
    const entries = buildSaleLedgerEntries({
      organizationId: "org1",
      transactionId: "txn1",
      orderId: "order1",
      fanId: "fan1",
      creatorId: "creator1",
      feeSplit,
      contributorShares: [],
      idempotencyKey: "order1:sale",
    });
    expect(() => assertBalanced(entries)).not.toThrow();
    expect(entries).toHaveLength(3);
    const creatorEntry = entries.find((e) => e.accountType === "CREATOR_BALANCE")!;
    expect(creatorEntry.amount.amountMinorUnits).toBe(900);
  });

  test("splits creator net across contributors and stays balanced", () => {
    const feeSplit = calculateFeeSplit({ amountMinorUnits: 1_000, currency: "USD" }, 1_000);
    const entries = buildSaleLedgerEntries({
      organizationId: "org1",
      transactionId: "txn1",
      orderId: "order1",
      fanId: "fan1",
      creatorId: "creator1",
      feeSplit,
      contributorShares: [{ accountRefId: "collaborator1", amountMinorUnits: 300 }],
      idempotencyKey: "order1:sale",
    });
    expect(() => assertBalanced(entries)).not.toThrow();
    const collaboratorEntry = entries.find(
      (e) => e.accountType === "CONTRIBUTOR_BALANCE" && e.accountRefId === "collaborator1",
    )!;
    expect(collaboratorEntry.amount.amountMinorUnits).toBe(300);

    const creatorEntries = withIds(entries).filter((e) => e.accountRefId === "creator1");
    expect(computeAccountBalance(creatorEntries).amountMinorUnits).toBe(600);
  });

  test("rejects contributor shares exceeding creator net", () => {
    const feeSplit = calculateFeeSplit({ amountMinorUnits: 1_000, currency: "USD" }, 1_000);
    expect(() =>
      buildSaleLedgerEntries({
        organizationId: "org1",
        transactionId: "txn1",
        orderId: "order1",
        fanId: "fan1",
        creatorId: "creator1",
        feeSplit,
        contributorShares: [{ accountRefId: "collaborator1", amountMinorUnits: 1_000 }],
        idempotencyKey: "order1:sale",
      }),
    ).toThrow();
  });
});

describe("buildPayoutLedgerEntries", () => {
  test("debits creator balance and credits payout clearing", () => {
    const entries = buildPayoutLedgerEntries({
      organizationId: "org1",
      transactionId: "txn2",
      creatorId: "creator1",
      amount: { amountMinorUnits: 500, currency: "USD" },
      idempotencyKey: "payout1",
    });
    expect(() => assertBalanced(entries)).not.toThrow();
    expect(entries.find((e) => e.accountType === "CREATOR_BALANCE")!.direction).toBe("DEBIT");
    expect(entries.find((e) => e.accountType === "PAYOUT_CLEARING")!.direction).toBe("CREDIT");
  });
});

describe("buildCompensatingEntries", () => {
  test("reverses a prior transaction without mutating it", () => {
    const feeSplit = calculateFeeSplit({ amountMinorUnits: 1_000, currency: "USD" }, 1_000);
    const original = withIds(
      buildSaleLedgerEntries({
        organizationId: "org1",
        transactionId: "txn1",
        orderId: "order1",
        fanId: "fan1",
        creatorId: "creator1",
        feeSplit,
        contributorShares: [],
        idempotencyKey: "order1:sale",
      }),
    );
    const reversal = buildCompensatingEntries(original, "txn1-refund", "order1:refund");
    expect(() => assertBalanced(reversal)).not.toThrow();
    expect(reversal.every((e) => e.entryType === "COMPENSATING")).toBe(true);

    const creatorEntry = original.find((e) => e.accountType === "CREATOR_BALANCE")!;
    const reversalOfCreatorEntry = reversal.find(
      (e) => e.accountType === "CREATOR_BALANCE" && e.reversalOfEntryId === creatorEntry.id,
    )!;
    expect(reversalOfCreatorEntry.direction).toBe("DEBIT");

    const allEntries = [...original, ...withIds(reversal)];
    const creatorEntries = allEntries.filter((e) => e.accountRefId === "creator1");
    expect(computeAccountBalance(creatorEntries).amountMinorUnits).toBe(0);
  });
});

describe("assertBalanced", () => {
  test("throws when debits and credits differ", () => {
    expect(() =>
      assertBalanced([
        {
          organizationId: "org1",
          transactionId: "txn1",
          orderId: null,
          accountType: "PLATFORM_REVENUE",
          accountRefId: "org1",
          entryType: "PLATFORM_FEE",
          direction: "CREDIT",
          amount: { amountMinorUnits: 100, currency: "USD" },
          reversalOfEntryId: null,
          idempotencyKey: "x",
        },
      ]),
    ).toThrow();
  });
});
