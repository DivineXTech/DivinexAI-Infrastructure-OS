# Payments

## Money model

Every amount is an **integer number of minor currency units** (cents, kobo,
...) — `modules/money/calculations.ts` is the only place price math happens,
and it's unit-tested (`calculations.test.ts`, 15 cases covering discount
rounding, fee computation, negative-net clamping, and PWYW clamping).

```
computePriceBreakdown({ subtotalMinor, coupon, feeRule, taxMinor })
  → { subtotalMinor, discountMinor, platformFeeMinor, taxMinor, totalMinor, creatorNetMinor }
```

The discount is applied **before** the platform fee is computed on the
discounted subtotal; the platform fee is never allowed to push
`creatorNetMinor` below zero.

## The server is the sole source of price truth

`modules/checkout/service.ts#startCheckout` takes only a `productId` (plus
optional coupon code / PWYW amount) from the client — never a price. It:

1. Loads the product server-side and confirms it's `published`.
2. Resolves the price: fixed → `product.base_price_minor`; PWYW → the
   submitted amount clamped up to `pwyw_minimum_minor`; free → 0.
3. Validates and applies a coupon (active, not expired, under its
   redemption limit) via `computeDiscount`.
4. Resolves the applicable `platform_fee_rules` row and computes the full
   breakdown.
5. Writes a `checkout_sessions` row with the computed breakdown as the
   record of what the buyer is being asked to pay.

A buyer manipulating the checkout form in the browser can change which
`productId` or `couponCode` is submitted, but not the price used for any of
those — the price for that product/coupon combination is always
recomputed server-side.

## Mock provider (Phase 1 — the only one wired up)

`modules/payments/mock-provider.ts` implements `PaymentProvider` with no
network calls. `startCheckout` calls `createPaymentIntent`, which returns a
`clientAction: { type: "confirm", payload: { willSucceed } }` —
`willSucceed` is `false` only if the buyer's email starts with
`declined@`, letting the failure path be exercised in tests without special
plumbing. The checkout page (`app/checkout/[slug]/page.tsx` →
`submitCheckoutAction`) immediately calls `completeCheckout(sessionId,
willSucceed)`.

`completeCheckout` (still `modules/checkout/service.ts`), run with the
service-role client so it can write across every commerce table in one
place:

1. Creates the `orders` row (`fulfilled` on success, `failed` otherwise) and
   an immutable `order_items` snapshot (title, type, and price **copied at
   purchase time** — later product edits never alter historical orders).
2. Records the `payments` row.
3. On success only: creates an `entitlements` row (the buyer's access
   grant), records the coupon redemption and increments its counter,
   increments `products.units_sold`, upserts the `customers` CRM row, and
   writes three `ledger_entries` (`customer_payment` credit,
   `platform_fee` debit, `creator_earning` credit) plus updates
   `creator_balances`.
4. Writes an `audit_logs` row (`order.fulfilled` or
   `order.payment_failed`).

## Adding a real provider

Implement `PaymentProvider` (`modules/payments/provider.ts`) for
Stripe/Paystack/Flutterwave and switch `getPaymentProvider()`
(`modules/payments/index.ts`) to select by `PAYMENT_MODE` + creator
country/currency + `payment_provider_configs`. Checkout/webhook business
logic in `modules/checkout/service.ts` does not need to change — see
API_INTEGRATION_GUIDE.md.

Required for any real provider, not yet built (Phase 2):

- Webhook signature verification (the `verifyWebhook` method exists on the
  interface for this) and idempotent processing keyed on
  `payment_events.(provider, provider_event_id)` — the unique constraint is
  already in the schema.
- Refund/dispute handling against the `refunds`/`disputes` tables.
- Country/provider availability resolution reading
  `payment_provider_configs`.

## What is explicitly not live

No live payment provider is configured or claimed to be. `/trust` lists
payment methods with an honest status badge per method (mock: active;
Stripe/Paystack/Flutterwave: "Planned — Phase 2"; mobile money: "Planned —
Phase 4"). Card details are never collected or stored by this application.
