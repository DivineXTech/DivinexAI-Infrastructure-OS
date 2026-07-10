# Database

Postgres via Supabase. All migrations live in `supabase/migrations/*.sql`,
applied in filename order, and are written to run on a **real Supabase
project** (they assume `auth.users`, `auth.uid()`, and the `storage` schema
already exist — Supabase provides these).

## Migration list

| File | Contents |
|---|---|
| `0001_extensions_and_helpers.sql` | Extensions, `app` schema, `updated_at` trigger, all enum types |
| `0002_lookup_tables.sql` | `currencies`, `countries`, `payment_provider_configs`, `platform_fee_rules`, `platform_plans`, `platform_settings`, `feature_flags`, `product_categories`, `product_tags` |
| `0003_identity.sql` | `profiles`, `user_roles`, `handle_new_auth_user()` trigger, `is_platform_admin()` |
| `0004_creators.sql` | `creator_accounts`, `creator_members`, `seller_verifications`, `is_creator_member()` |
| `0005_storefronts.sql` | `storefronts`, `storefront_links`, `followers` |
| `0006_catalog.sql` | `products`, `product_media`, `product_files`, category/tag assignment tables, `product_submissions`, `product_bundles`, `bundle_items` |
| `0007_commerce.sql` | `coupons`, `coupon_redemptions`, `checkout_sessions`, `orders`, `order_items`, `payments`, `payment_events`, `refunds`, `disputes`, `entitlements`, `download_events`, `ledger_entries`, `creator_balances`, `customers` |
| `0008_audit_and_analytics.sql` | `audit_logs`, `analytics_events`, `daily_analytics_rollups`, `notifications`, `notification_preferences` |
| `0009_future_phase_schema.sql` | Schema-only tables for reviews, reports, support tickets, subscribers, affiliates, courses, memberships, AI generations, platform subscriptions — see below |
| `0010_storage_buckets.sql` | `product-files` (private), `product-media` / `avatars` (public) buckets + `storage.objects` policies |
| `0011_seed_reference_data.sql` | Platform configuration data: currencies, countries, plans, default fee rule, categories, feature flags. **Not demo content** — safe for production. |

Demo creators/products are seeded separately by `scripts/seed.ts`, never by
a migration.

## Why some tables are schema-only

`0009_future_phase_schema.sql` creates `reviews`, `reports`,
`support_tickets`, `subscribers`, `affiliate_*`, `courses`/`course_*`,
`membership_plans`/`subscriptions`, `ai_generations`/`ai_credit_ledger`, and
`platform_subscriptions` — per the brief's instruction to design the schema
for all listed domains up front rather than migrate disruptively later. None
of these are read or written by Phase 1 application code, and RLS on all of
them defaults to admin/service-role-only via a single loop at the bottom of
that migration, so an unfinished feature can never accidentally expose data.

## Money

Every amount column is an integer (`_minor` suffix) — no `numeric`/`float`
for money anywhere. See PAYMENTS.md for the calculation flow that produces
these values.

## Row-Level Security

Every table has RLS enabled. The load-bearing helper functions (all
`security definer`, `stable`, defined once and reused):

- `public.is_platform_admin()` — true for `super_admin`, `marketplace_admin`,
  `moderator`, `support_agent`, `finance_admin` roles in `user_roles`.
- `public.is_creator_member(creator_id, allowed_roles?)` — true if
  `auth.uid()` is an **accepted** member of that creator account, optionally
  restricted to specific `creator_member_role`s.

Two properties worth knowing when adding new tables/policies:

1. **`RETURNING` timing.** `creator_accounts`' SELECT policy checks
   `owner_id = auth.uid()` **in addition to** `is_creator_member()`, because
   the owning `creator_members` row is only inserted by an `AFTER INSERT`
   trigger (`handle_new_creator_account`), and Postgres evaluates the
   `RETURNING` clause's SELECT policy before that trigger's effects are
   visible within the same statement. Without the `owner_id` fallback,
   `supabase.from("creator_accounts").insert(...).select()` — the standard
   Supabase JS pattern — fails. This was caught by testing the actual insert
   against a local Postgres instance with RLS enforced (see below), not by
   reading the policy.
2. **Checkout/orders/payments/entitlements/ledger have no client-facing
   INSERT or UPDATE policy at all.** They're written exclusively through
   `createSupabaseAdminClient()` from `modules/checkout/service.ts`, which
   computes price server-side. A buyer's own session can only ever `SELECT`
   their own rows.

## Validating migrations without a Supabase project

Supabase provides `auth.uid()`/`auth.users` and the `storage` schema in
every real project; a plain local Postgres instance doesn't. To validate
migration SQL and RLS behavior without a live project,
`scripts/local-dev-auth-shim.sql` creates a minimal stand-in — an `auth`
schema with `uid()` reading a settable session GUC
(`request.jwt.claim.sub`), and a `storage.buckets`/`storage.objects`/
`storage.foldername()` stand-in. **Never run this against a real Supabase
project** — it would conflict with Supabase's real schemas.

This is how the RLS bug above was actually found: applying all migrations
to local Postgres, creating `authenticated`/`anon` roles, setting the JWT
claim GUC per "session", and attempting real inserts/updates/selects as
different simulated users — including a cross-tenant write attempt (blocked,
0 rows affected) and a cross-tenant private-file-metadata read attempt
(blocked, 0 rows returned).

## Generating real TypeScript types

`src/lib/supabase/types.ts` is currently **hand-written** to match the
shape `supabase gen types typescript` produces (including the
`Relationships: []` field newer `@supabase/postgrest-js` versions require
for type inference — omitting it silently resolves every query's row type
to `never` instead of erroring, which is worth knowing if you extend this
file by hand). Once a real project exists, regenerate properly:

```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/types.ts
```
