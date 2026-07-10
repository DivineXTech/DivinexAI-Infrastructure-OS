# Deployment

Frontend targets **Vercel**; backend is a **Supabase** project. Neither is
configured in this repository — this document is the setup path.

## 1. Create the Supabase project

1. Create a project at supabase.com (or self-host).
2. Apply every migration in `supabase/migrations/*.sql`, in filename order,
   via the SQL editor or `psql` (see README.md's "Database setup" section).
   `0011_seed_reference_data.sql` seeds real platform configuration
   (currencies, countries, plans, categories) and should run in every
   environment including production.
3. In Storage, confirm the three buckets from `0010_storage_buckets.sql`
   exist (`product-files` private, `product-media`/`avatars` public) — the
   migration creates them via `insert into storage.buckets`, but double
   check bucket policies applied if you ran migrations out of order.
4. Note the project URL, anon key, and service role key from Settings > API.

## 2. Configure environment variables

Set every variable in `.env.example` in Vercel's project settings (or your
hosting provider's equivalent). At minimum for a working deployment:
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Leave
`PAYMENT_MODE=mock` until a real provider is integrated (PAYMENTS.md) —
do not set live payment provider keys without also implementing and
reviewing that provider's adapter and webhook handling.

## 3. Deploy the frontend

Standard Vercel Next.js deployment — no custom build command needed
(`next build` / `next start`). Because nearly every authenticated route sets
`export const dynamic = "force-dynamic"` (see ARCHITECTURE.md), Vercel will
render those on-demand rather than statically; the public marketplace pages
also opt into `force-dynamic` today (correctness over caching, since
listings must reflect live inventory) — revisit with ISR/ on-demand
revalidation once traffic patterns are known.

## 4. Grant an admin

No UI creates the first admin. After a real signup, grant `super_admin`
directly:

```sql
insert into public.user_roles (user_id, role)
values ('<the user''s auth.users.id>', 'super_admin')
on conflict do nothing;
```

Or run `npm run seed` with `ADMIN_EMAIL_ALLOWLIST` set, which creates (or
reuses) that user and grants the role.

## 5. Post-deploy checklist

- [ ] Migrations applied, `0011` reference data present
- [ ] Storage buckets exist with correct public/private settings
- [ ] Env vars set, `SUPABASE_SERVICE_ROLE_KEY` **not** exposed to the client
- [ ] At least one `super_admin` user granted
- [ ] `PAYMENT_MODE` intentionally set (stay on `mock` unless a real
      provider adapter has been built and reviewed)
- [ ] Legal pages (`/legal/*`) reviewed by counsel before claiming
      production readiness (COMPLIANCE_NOTES.md)
