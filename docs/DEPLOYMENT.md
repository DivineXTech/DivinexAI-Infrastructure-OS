# Deployment

Not yet deployed anywhere — this covers what's needed before it can be.

## Prerequisites

1. A real Supabase project (not the placeholder values in `.env.example`).
2. Apply `supabase/migrations/` to it (via `supabase db push` or the
   Supabase dashboard's SQL editor).
3. **Never** run `supabase/seed/seed.sql` or `npm run seed` against
   production — both are explicitly dev-only (see docs/DATABASE.md,
   docs/TESTING.md). They create demo accounts with a shared, publicly
   documented password.
4. Set real environment variables (see `.env.example` for the full list):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from the
     Supabase project settings.
   - `SUPABASE_SERVICE_ROLE_KEY` — only if/where admin tooling needs it;
     never expose to the client, never commit it.
   - `PAYMENTS_MODE=mock` until a real payments provider is implemented
     (see docs/PAYMENTS.md) — do not set `live` before that exists, since
     `getPaymentsProvider()` throws in that case by design.
   - `DIVINEXAI_API_BASE_URL` / `DIVINEXAI_API_KEY` — leave unset until a
     real DivinexAI service implementation exists (see
     docs/DIVINEXAI_INTEGRATION.md); setting them without an implementation
     also throws by design.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run start   # or deploy the .next build output to your host of choice
```

## First real-environment checklist

- [ ] Run the tenant-isolation integration test against the real project
      (docs/TESTING.md) before trusting RLS in that environment.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is not present in any client
      bundle (`npm run build` output) or committed file.
- [ ] Confirm email confirmation is configured the way you want in
      Supabase Auth settings (signup currently branches on whether a
      session comes back immediately — see `app/(auth)/signup/page.tsx`).
- [ ] Decide real Terms/Privacy copy before removing the placeholder
      notices on `/terms` and `/privacy`.

## Not yet configured

No CI workflow, no Dockerfile, no hosting-specific config (Vercel/etc.)
exists yet. This is Phase 9 (Hardening) scope per
`docs/IMPLEMENTATION_PLAN.md`.
