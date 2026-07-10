# Environment variables

See `.env.example` for the canonical list. Details on each:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | No | Defaults to `http://localhost:3000`. Used for absolute links (e.g. password reset redirect). |
| `NEXT_PUBLIC_APP_NAME` | No | Defaults to "FlowraMarket Africa". |
| `NEXT_PUBLIC_SUPABASE_URL` | For any Supabase feature | Project URL from Supabase Settings > API. Public — safe in client bundles. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For any Supabase feature | Anon/public key. RLS is what actually protects data, not secrecy of this key. |
| `SUPABASE_SERVICE_ROLE_KEY` | For checkout, catalog reads, admin actions, seeding | **Server-only.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. Only imported from files marked `server-only` (`lib/supabase/admin.ts`). |
| `DATABASE_URL` | Only for `npm run db:migrate:local` | Direct Postgres connection string for local migration validation. Not read by the Next.js app. |
| `PAYMENT_MODE` | No | `mock` (default) or `live`. `live` currently has no effect — no real provider is wired up (PAYMENTS.md). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | No | Reserved for the Phase 2 Stripe adapter. Unused today. |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET` | No | Reserved for the Phase 2 Paystack adapter. Unused today. |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_WEBHOOK_SECRET` | No | Reserved for the Phase 2 Flutterwave adapter. Unused today. |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` / `EMAIL_FROM_ADDRESS` | No | Reserved for Phase 3 creator email tools. Unused today. |
| `AI_PROVIDER` / `AI_API_KEY` | No | Reserved for Phase 3 AI Creator Studio. Unused today. |
| `STORAGE_PROVIDER` | No | Informational; the only implementation is Supabase Storage (`modules/storage/supabase-storage.ts`). |
| `PLATFORM_DEFAULT_CURRENCY` | No | Defaults to `USD`. |
| `PLATFORM_SUPPORT_EMAIL` | No | Defaults to `support@flowramarket.africa`. |
| `ADMIN_EMAIL_ALLOWLIST` | No | Comma-separated. Only the first address is used, by `scripts/seed.ts`, to grant `super_admin`. |
| `CRON_SECRET` | No | Reserved for future scheduled-job authentication (e.g. `daily_analytics_rollups`). Nothing reads it yet. |
| `ENCRYPTION_KEY` | No | Reserved for future field-level encryption needs. Nothing reads it yet. |

## Validation

`lib/env.ts` parses `process.env` through a Zod schema once per process
(`getEnv()`), with every Supabase-dependent field optional so the app
degrades gracefully (`isSupabaseConfigured()`) instead of throwing when the
project isn't configured — used throughout the marketing pages and
`modules/auth/session.ts` to redirect instead of crash.

## Never commit

`.gitignore` excludes `.env*.local`. `.env.example` contains empty
placeholders only — no real values were ever added to it.
