# Payments

Provider-neutral interface, defined in `lib/payments/types.ts`
(`PaymentsProvider`). All amounts are integer minor units (cents) — never
floats.

## Current state (Phase 1)

Only `lib/payments/mock-provider.ts` (`MockPaymentsProvider`) is
implemented. It simulates an instantly-succeeding checkout with **no
external network calls**. `getPaymentsProvider()`
(`lib/payments/index.ts`) returns it whenever `PAYMENTS_MODE=mock` (the
default — see `.env.example`), and throws if `PAYMENTS_MODE=live` is set
without a real provider implementation, so the app fails loudly instead of
silently pretending a live payment succeeded.

**Never represent a mock-mode checkout as a real charge in UI copy.**

## Adding a real provider (Stripe first)

1. Implement `PaymentsProvider` (`createCheckoutSession`, `getPayment`,
   `refundPayment`) against the real API in a new file, e.g.
   `lib/payments/stripe-provider.ts`.
2. Add `STRIPE_SECRET_KEY` validation to `lib/env.ts` (the field already
   exists as optional; make it required once `PAYMENTS_MODE=live` and this
   provider is selected).
3. Wire it into `getPaymentsProvider()` behind `PAYMENTS_MODE=live`.
4. Never call the real provider from a Client Component — checkout
   session creation must be a Server Action or Route Handler.

## Planned providers

Stripe, FlowraPay, PayPal, Flutterwave, Paystack, and mobile-money
providers are all in scope per the product spec, behind the same
interface. None are implemented yet.

## Entities (not yet persisted — no `orders`/`payments` tables exist until
Phase 5/6)

`CheckoutSession`, `Payment`, `Refund` types exist in
`lib/payments/types.ts` today as the contract shape; the corresponding
database tables (`orders`, `order_items`, invoices, payouts, marketplace
fees, tenant revenue share) ship with the commerce phase per
`docs/IMPLEMENTATION_PLAN.md`.
