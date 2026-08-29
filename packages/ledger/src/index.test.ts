import { describe, expect, test } from "bun:test";
import { calculateFeeSplit } from "@divinexai/fees";
import {
  assertBalanced,
  buildCompensatingEntries,
  buildPayoutLedgerEntries,
  buildSaleLedgerEntries,
  computeAccountBalance,
} from "./index";
import { floorBpsOf, type LedgerEntry } from "@divinexai/schemas";

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

  describe("multi-contributor split invariants", () => {
    /** Mirrors how dmtv-core computes each non-creator contributor's share: floor(creatorNet * splitBps / 10000), same as production. */
    function splitSharesFor(
      creatorNetMinorUnits: number,
      contributorBpsList: number[],
    ): Array<{ accountRefId: string; amountMinorUnits: number }> {
      return contributorBpsList.map((bps, i) => ({
        accountRefId: `collaborator${i}`,
        amountMinorUnits: floorBpsOf(creatorNetMinorUnits, bps),
      }));
    }

    const scenarios: Array<{ label: string; grossCents: number; bps: number; splits: number[] }> = [
      { label: "even 3-way split with a 1-bps remainder", grossCents: 1_000, bps: 1_000, splits: [3_334, 3_333, 3_333] },
      { label: "even 3-way split of $4.99 net", grossCents: 499, bps: 1_000, splits: [3_334, 3_333, 3_333] },
      { label: "uneven 5-way split", grossCents: 29_900, bps: 600, splits: [3_000, 2_500, 2_000, 1_500, 1_000] },
      { label: "two contributors splitting all of creator net (creator keeps only rounding dust)", grossCents: 1_000_000, bps: 400, splits: [5_000, 5_000] },
      { label: "single tiny amount split three ways", grossCents: 5, bps: 1_000, splits: [3_334, 3_333, 3_333] },
    ];

    for (const scenario of scenarios) {
      test(scenario.label, () => {
        const feeSplit = calculateFeeSplit({ amountMinorUnits: scenario.grossCents, currency: "USD" }, scenario.bps);
        const contributorShares = splitSharesFor(feeSplit.creatorNetAmount.amountMinorUnits, scenario.splits);

        const entries = buildSaleLedgerEntries({
          organizationId: "org1",
          transactionId: "txn1",
          orderId: "order1",
          fanId: "fan1",
          creatorId: "creator1",
          feeSplit,
          contributorShares,
          idempotencyKey: "order1:sale",
        });

        // (10) Every transaction's entries balance exactly (debits === credits).
        expect(() => assertBalanced(entries)).not.toThrow();

        // (9) The rounding remainder from splitting creator net across
        // contributors never creates or destroys money: gross is fully
        // accounted for across platform fee + every contributor's credited
        // share + whatever residual dust is left on the creator's own
        // balance.
        const withIdsEntries = withIds(entries);
        const platformFeeTotal = withIdsEntries
          .filter((e) => e.accountType === "PLATFORM_REVENUE")
          .reduce((sum, e) => sum + (e.direction === "CREDIT" ? e.amount.amountMinorUnits : -e.amount.amountMinorUnits), 0);
        const creatorBalance = computeAccountBalance(withIdsEntries.filter((e) => e.accountRefId === "creator1"));
        const contributorTotal = contributorShares.reduce((sum, c) => sum + c.amountMinorUnits, 0);
        for (const share of contributorShares) {
          const creditedEntries = withIdsEntries.filter(
            (e) => e.accountType === "CONTRIBUTOR_BALANCE" && e.accountRefId === share.accountRefId,
          );
          expect(computeAccountBalance(creditedEntries).amountMinorUnits).toBe(share.amountMinorUnits);
        }

        expect(platformFeeTotal + creatorBalance.amountMinorUnits + contributorTotal).toBe(scenario.grossCents);
        // The creator's residual is never negative -- the split math never over-allocates.
        expect(creatorBalance.amountMinorUnits).toBeGreaterThanOrEqual(0);
      });
    }
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
