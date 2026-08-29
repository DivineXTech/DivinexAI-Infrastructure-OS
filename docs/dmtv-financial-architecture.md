# DMTV financial architecture

This document records the audited financial invariants for DMTV's commerce
and ledger system: the rounding policy, why it was chosen, how it
generalizes to future allocations, and how idempotency and refunds are
guaranteed not to create, destroy, or silently duplicate money.

## 1. The rounding policy

**Policy: floor every deduction; the residual (creator net) is derived, never independently rounded.**

`calculateFeeSplit` (`packages/fees/src/index.ts`) computes the platform
fee as `floor(gross * platformFeeBps / 10000)`, using exact integer
(BigInt) arithmetic via `floorBpsOf` (`packages/schemas/src/common.ts`) --
never the `/` operator on a multiplied value, which is IEEE-754 binary
floating-point and is not guaranteed bit-exact for every integer input
(`10000` has no exact binary fraction). Creator net is then `gross -
platformFee`: a subtraction, not a second independently-rounded
percentage.

### Audited case: $4.99 at the FREE tier's 10% fee

```
gross            = 499 cents
platformFeeBps   = 1000  (10%)
platformFee      = floor(499 * 1000 / 10000) = floor(49.9) = 49 cents  ($0.49)
creatorNet       = 499 - 49 = 450 cents                                ($4.50)
```

This is **intentional**, not a bug. A naive round-half-up implementation
would produce a $0.50 fee / $4.49 net instead. Two reasons this codebase
floors instead:

1. **The platform can never collect more than its exact advertised rate on
   any single transaction.** Flooring guarantees
   `platformFeeAmount <= grossAmount * platformFeeBps / 10000` always;
   round-half-up would let the platform take slightly *more* than 10% on
   individual transactions (evening out only in aggregate over many
   transactions, if at all favorable to the merchant). For a platform
   whose pricing page says "10%", never charging more than exactly 10% on
   any one sale is a stronger, auditable guarantee.
2. **Determinism without a residual-assignment rule.** Because the
   residual (creator net) is computed by subtraction rather than by its
   own rounding, `gross === platformFee + creatorNet` holds exactly for
   every input -- there is no rounding remainder left over to assign
   anywhere. Any other split-then-round-both-sides approach requires a
   separate rule for who absorbs the odd cent; flooring one side and
   deriving the other eliminates that class of bug entirely.

Both behaviors were verified with a BigInt-derived exact reference across
a full sweep of amounts and rates in `packages/fees/src/index.test.ts`.

## 2. Never use binary floating-point arithmetic for money

Two boundary conversions in the codebase turn a value into an integer
amount of minor units; both avoid the `/` and `*` float operators on the
values that determine money:

- **Rate application:** `floorBpsOf(amountMinorUnits, bps, bpsBase)`
  (`packages/schemas/src/common.ts`) computes
  `(BigInt(amountMinorUnits) * BigInt(bps)) / BigInt(bpsBase)` and converts
  the result back to `Number` only once it is already an exact integer.
  Every fee, contributor split, and (future) tax/processing-fee/partner
  allocation goes through this function.
- **Decimal string parsing:** `parseDecimalToMinorUnits(input,
  decimalPlaces)` (`packages/schemas/src/common.ts`) turns a human-typed
  dollar amount (e.g. a product price form field, `"4.99"`) into minor
  units via string splitting and `BigInt`, never `Number(input) *
  10**decimalPlaces`. `apps/dmtv-web`'s product-price form uses this
  instead of `Math.round(Number(priceDollars) * 100)`.

Display formatting (turning stored minor units back into a `"$4.99"`
string for a receipt or storefront) still divides by 100 as a float --
that is presentation only, never round-trips into a stored or computed
amount, and so carries no risk of creating or destroying money.

## 3. The generalized invariant

Required invariant:

```
gross_amount = platform_fee + processing_fee + creator_net + taxes
             + partner/affiliate allocations + other explicit allocations
```

DMTV v1's live purchase flow only has two terms
(`platform_fee + creator_net`; the other terms are implicitly zero), and
the invariant holds for it by construction as shown above. Contributor
splits *within* `creator_net` are handled the same way: each non-creator
contributor's share is `floorBpsOf(creatorNet, contributor.revenueSplitBps)`
(`packages/dmtv-core/src/services.ts`), and the creator's own balance
absorbs whatever rounding remainder is left (`creatorNet -
sum(contributorShares)`), which can never be negative because each share
is floored down. This is the "residual-to-creator" policy for split
rounding, exactly parallel to "residual-to-creator" for the platform fee.
`packages/ledger/src/index.test.ts`'s "multi-contributor split invariants"
suite proves this for 2-, 3-, and 5-way splits, including a scenario where
two contributors split 100% of creator net between them (the creator's
"residual" is then whatever sub-cent dust the split left over, never
negative).

`packages/fees/src/index.ts` also exports `calculateWaterfallSplit`, a
generalization of `calculateFeeSplit` to an arbitrary ordered list of
`{ name, bps }` allocations (platform fee, processing fee, tax,
partner/affiliate cuts, ...). Each allocation is floored independently;
the residual is always `gross - sum(allocations)`. This is **Phase 2
preparation**: when processing fees, taxes, or partner/affiliate splits
are actually introduced, they become additional entries in the
allocations list, and the invariant continues to hold without
re-deriving it. Two things are *not* done yet, deliberately, since no such
allocation exists in v1:

- `packages/ledger`'s `entry_type` enum (both the Zod schema and the
  Postgres check constraint on `ledger_entries`) has no `TAX`,
  `PROCESSING_FEE`, or `PARTNER_ALLOCATION` value yet. Adding one is a
  small, additive migration (`ledger_entries` already has ORDER_ID/account
  columns generic enough to carry them) at the point a real allocation is
  wired up.
- `buildSaleLedgerEntries` (`packages/ledger/src/index.ts`) still only
  builds entries for `platform_fee` + `creator_net` (+ contributor
  splits). It is the natural place to fold in `calculateWaterfallSplit`'s
  output once there is more than one deduction to record.

## 4. Idempotency

`purchaseProduct` (`packages/dmtv-core/src/services.ts`) takes a
caller-supplied `idempotencyKey`. Before charging the fan or writing
anything, it looks up whether an order with that key already exists
(`getOrderByIdempotencyKey`); if so, it returns the original order and its
original ledger entries without calling FlowraPay again and without
writing a new order or ledger row. `orders` also carries a
`unique (organization_id, idempotency_key)` database constraint as a
second line of defense against a race between the lookup and the insert.
Verified in `packages/dmtv-core/test/lifecycle.test.ts` by calling
`purchaseProduct` three times with the same key and asserting: the
returned order id is identical every time, the same ledger entry ids come
back every time, exactly one sale's worth of entries exist in the
database for that order, and the creator's balance reflects exactly one
sale, not three.

## 5. Refunds and reversals

`refundOrder` (`packages/dmtv-core/src/services.ts`) never edits or
deletes a completed order's original ledger entries. It fetches them,
builds compensating entries with `buildCompensatingEntries`
(`packages/ledger/src/index.ts` -- one reversal entry per original entry,
opposite direction, `reversalOfEntryId` pointing at the original,
`entryType: "COMPENSATING"`), inserts only those new rows, and transitions
the order's `status` to `REFUNDED` (a status change, not a rewrite of its
`gross_amount`). Calling `refundOrder` again on an already-`REFUNDED`
order is a no-op that returns the existing compensating entries rather
than reversing a second time. Verified end-to-end in
`packages/dmtv-core/test/lifecycle.test.ts`: after a refund, the
originally-recorded ledger entries are fetched back from the database and
compared byte-for-byte (`toEqual`) against what was recorded at purchase
time, the creator's balance is confirmed to return exactly to zero, and a
second `refundOrder` call is confirmed to return the same compensating
entries rather than creating new ones or moving the balance further.

## 6. Where to look

| Concern | Location |
| --- | --- |
| Exact bps math, decimal string parsing | `packages/schemas/src/common.ts` |
| Fee schedule, single-fee split, N-way waterfall split | `packages/fees/src/index.ts` |
| Double-entry ledger construction, compensating entries, balance | `packages/ledger/src/index.ts` |
| Purchase (idempotent), refund, contributor split application | `packages/dmtv-core/src/services.ts` |
| Fee/rate audit matrix ($0.01 through $10,000 x all v1 rates) | `packages/fees/src/index.test.ts` |
| Multi-contributor split invariants | `packages/ledger/src/index.test.ts` |
| End-to-end idempotency and refund tests against real Postgres | `packages/dmtv-core/test/lifecycle.test.ts` |
| Ledger/orders RLS: no `authenticated` write path at all | `packages/db/migrations/0008_rls_policies.sql`, `packages/db/test/rls.test.ts` |
