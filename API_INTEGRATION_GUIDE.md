# API integration guide

How to add a real provider behind each of the interfaces in `modules/`.
None of these are implemented beyond mock/Supabase today — this is the
extension point, not a description of existing integrations.

## Adding a payment provider (e.g. Stripe)

1. Implement `PaymentProvider` (`modules/payments/provider.ts`) in a new
   file, e.g. `modules/payments/stripe-provider.ts`:
   - `createPaymentIntent(input)` → call the provider's API, return a
     `clientAction` (`{ type: "redirect", url }` for a hosted checkout page,
     or `{ type: "confirm", payload }` for client-side confirmation).
   - `verifyWebhook(rawBody, headers)` → verify the provider's signature
     header and return the normalized event.
   - `refund(providerReference, amountMinor)` → call the provider's refund
     API.
2. Update `getPaymentProvider()` (`modules/payments/index.ts`) to select
   the provider based on `PAYMENT_MODE`, creator country/currency, and
   `payment_provider_configs` rows.
3. Add a webhook Route Handler (e.g. `app/api/webhooks/stripe/route.ts`)
   that: reads the raw body, calls `provider.verifyWebhook()`, inserts a
   `payment_events` row keyed on `(provider, provider_event_id)` — the
   unique constraint makes a duplicate delivery a no-op — and only then
   calls `completeCheckout()` or the equivalent refund/dispute handler.
4. `modules/checkout/service.ts`'s `startCheckout`/`completeCheckout` do
   not need to change — they already operate against the `PaymentProvider`
   interface, not a concrete implementation.
5. Never store card data. Only store `provider_reference` /
   `provider_event_id` strings.

## Adding an email provider

No `EmailProvider` interface exists yet (Phase 3) — subscriber collection
and creator email tools aren't built. When they are, follow the same shape:
an interface in `modules/email/provider.ts`, a mock implementation for
local dev, and a real adapter selected by `EMAIL_PROVIDER`.

## Adding an AI provider

Same note as email: no `AIProvider` interface exists yet. AI Creator Studio
is Phase 3. When built, the interface should cover: generate(prompt,
context) → { text, tokensUsed }, with generation history written to
`ai_generations` and credit consumption to `ai_credit_ledger` (both tables
already exist). Per the product brief, AI output must always require
explicit user approval before being applied — never auto-published.

## Adding another storage backend

Implement `StorageProvider` (`modules/storage/provider.ts`):
`createSignedDownloadUrl`, `createSignedUploadUrl`, `removeObject`. Swap the
implementation used by `modules/files/service.ts` and the product
media/file upload actions (`modules/products/actions.ts`).

## Regenerating database types after a schema change

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

If you extend `src/lib/supabase/types.ts` by hand instead (no live project
yet), every table needs a `Relationships: []` field and the schema object
needs `Views`/`Functions` keys — recent `@supabase/postgrest-js` versions
require this shape for type inference or every query silently resolves to
`never` (see DATABASE.md's note on this — it cost real debugging time here).
