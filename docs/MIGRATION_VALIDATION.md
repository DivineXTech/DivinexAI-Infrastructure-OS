# Migration Validation

**Status: statically reviewed, not yet run against a live Supabase project.**
This sandbox has no Docker daemon (`supabase start` needs one) and no
Supabase project credentials — see docs/SECURITY.md "Known gaps" and the
Phase 1.5 report for the full explanation. Everything below is what static
review of the SQL confirms; the "Live validation checklist" at the end is
what still needs to run once a real project is available, and how.

## Migration order

1. `20260715000000_foundation.sql` — profiles, tenants, roles, permissions,
   role_permissions, tenant_memberships, audit_logs; triggers; RLS.
2. `20260716000000_storage.sql` — Storage buckets + `storage.objects` RLS.
3. `20260716010000_prevent_privilege_escalation.sql` — trigger closing the
   `is_platform_super_admin` self-escalation hole (found during this
   Phase 1.5 review — see docs/SECURITY.md).
4. `20260717000000_leads.sql` (Phase 2) — public lead-capture table, with
   an anon-insert / super-admin-only-read RLS policy pair (the one
   deliberate exception to "no anonymous access" — see docs/SECURITY.md
   "Public lead capture").
5. `20260718000000_onboarding.sql` (Phase 3) — the onboarding wizard's 11
   tables; see docs/ONBOARDING.md.
6. `20260719000000_catalog.sql` (Phase 4) — garment templates, design
   studio, mockups, and the product catalog's 19 tables; see
   docs/DATABASE.md, docs/GARMENT_TEMPLATES.md, docs/DESIGN_STUDIO.md,
   docs/PRODUCT_CATALOG.md.

Applied in this order via filename timestamp, which is how Supabase's
migration tooling (`supabase db push` / `supabase migration up`) sequences
them — no manual ordering step needed.

## Phase 4: actually executed against a real Postgres instance

Unlike the migrations above (statically reviewed only, per this file's
opening note), `20260719000000_catalog.sql` and the updated
`supabase/seed/seed.sql` were **both actually applied** during
development, against a real local Postgres 16 instance (available in
this sandbox, though not a full Supabase stack — no `auth`/`storage`
schema, so those were stubbed with minimal compatible tables/functions
just enough to satisfy the foreign keys and RLS helper functions the
migrations reference). This is stronger evidence than static review, but
still short of the "Live validation checklist" below (real Supabase
Auth, real authenticated RLS sessions, real Storage). Specifically
verified by execution, not just by reading the SQL:

- The full migration chain (foundation through catalog) applies cleanly
  in order against a clean database.
- **Re-running the entire chain a second time is fully idempotent** — this
  caught a real bug: the first draft of `20260719000000_catalog.sql` used
  a bare `alter table ... add constraint` for `design_projects`'s
  `current_version_id` foreign key, which fails on a second run
  ("constraint already exists"). Fixed by wrapping it in a
  `do $$ if not exists (select 1 from pg_constraint where conname = ...) $$`
  guard, matching the `if not exists`/`drop ... if exists` pattern every
  other DDL statement in this file already follows.
- `supabase/seed/seed.sql`'s new Phase 4 section (platform garment
  templates + sizes/colors/views/print zones) applies cleanly and is
  idempotent (a second run inserts zero additional rows).
- The null-safe `product_variants_combo_idx` expression index actually
  rejects a duplicate size/color combination insert (not just believed to,
  from reading the SQL).

## Static validation performed

## Static validation performed

- **Tables**: every `create table` uses `if not exists`; columns, defaults,
  and `check` constraints read correctly on manual review (status enums,
  `not null` on required FKs).
- **Foreign keys**: `tenant_memberships.tenant_id → tenants.id`,
  `tenant_memberships.profile_id → profiles.id`,
  `tenant_memberships.role_id → roles.id` (`on delete restrict` —
  intentional: a role in use cannot be deleted out from under active
  memberships), `role_permissions` FKs to both `roles` and `permissions`,
  `audit_logs` FKs are nullable + `on delete set null`/`cascade`
  appropriately for an append-only log that should survive actor/tenant
  deletion where reasonable.
- **Constraints**: `tenants.slug` unique, `tenant_memberships (tenant_id,
  profile_id)` unique (one membership row per user per tenant).
- **Indexes**: `tenants_slug_idx` (partial, `where deleted_at is null`),
  `tenant_memberships_tenant_id_idx`, `tenant_memberships_profile_id_idx`,
  `audit_logs_tenant_id_idx`, `audit_logs_created_at_idx`.
- **RLS enabled + forced**: every table in the foundation migration has
  both `enable row level security` and `force row level security` —
  confirmed by grep, not just by having written it once.
- **Security-definer functions have explicit search paths**: all of
  `is_platform_super_admin`, `is_tenant_member`, `has_tenant_role`,
  `handle_new_auth_user`, `prevent_self_super_admin_escalation`,
  `storage.kpc_is_tenant_object`, `storage.kpc_has_tenant_admin_role` pin
  `set search_path` — required for `security definer` functions to avoid a
  search-path-hijacking privilege escalation.
- **Privilege escalation review**: this pass specifically re-read every
  policy asking "what's the worst update an authenticated user could make
  through this policy alone?" This is how
  `20260716010000_prevent_privilege_escalation.sql` was found: RLS is
  row-level only, so `profiles_update_own` (`using (id = auth.uid())`)
  could not stop a user from flipping their own
  `is_platform_super_admin` column. Fixed with a `before update` trigger
  that rejects any change to that column unless the connection is
  `service_role`. See docs/SECURITY.md for the two adjacent, narrower gaps
  left open on purpose (tenant_admin → tenant_owner self-promotion within
  the same tenant; loose `profile_id`/`role_id` reassignment on
  `tenant_memberships` writes) and why they weren't blocking.
- **Idempotency**: `create table/index/extension if not exists`, `create
  or replace function`, and `drop trigger if exists` before every
  `create trigger` are all safe to re-run. `create policy` has no
  `if not exists` form in Postgres, so every policy is preceded by
  `drop policy if exists <name> on <table>` — this migration file can be
  re-applied against a database that already has it without erroring.
  Bucket seeding uses `on conflict (id) do update`.
- **Clean-database run**: not executed (no live project) — read
  top-to-bottom for forward-reference errors (e.g. a table referencing
  another before it's created) and found none; every `references` clause
  points at a table defined earlier in the same file or already existing
  (`auth.users`).

## Known limitations (see docs/SECURITY.md for full detail)

- A `tenant_admin` can promote themselves to `tenant_owner` within their
  own tenant via `tenant_memberships_write_owner_admin` — not a
  platform-level escalation, but a narrower boundary than "admin" vs.
  "owner" implies. Not fixed in this pass.
- The same policy doesn't validate `profile_id`/`role_id` reassignment
  precisely enough to prevent an admin from repointing another member's
  row in unexpected ways within their own tenant. Not fixed in this pass.
- `audit_logs` has no insert policy for authenticated users by design —
  all writes go through `lib/audit/log.ts` using the service-role client.
  If `SUPABASE_SERVICE_ROLE_KEY` is unset, audit writes fail soft (logged
  to console, operation itself still succeeds) — see docs/SECURITY.md.

## Recovery procedure

If a migration fails partway through applying in a live project:

1. Because every DDL statement in these files is either `if not exists`,
   `or replace`, or preceded by its own `drop ... if exists`, simply
   re-running the same migration file (`supabase db push` again, or
   re-running the failed file's SQL directly) is safe and will finish
   applying whatever didn't apply the first time.
2. If a specific statement fails (e.g. a constraint violation from
   pre-existing data), fix the offending data or constraint by hand, then
   re-run — do not skip the migration or mark it applied without the
   underlying SQL actually having succeeded.
3. There is no automatic rollback (`down`) migration written yet. For
   Phase 1.5's tables, a manual rollback would be
   `drop table if exists public.audit_logs, public.tenant_memberships,
   public.role_permissions, public.permissions, public.roles,
   public.tenants, public.profiles cascade;` plus dropping the bucket rows
   and the functions/triggers listed above — write this as a proper
   `down.sql` before this schema carries real data anyone cares about.

## Live validation checklist (run once a Supabase project is available)

```bash
supabase link --project-ref <ref>      # or `supabase start` for local
supabase db push                       # applies all three migrations above
supabase db reset                      # clean-database run + seed/seed.sql
npm run seed                           # scripts/seed.ts (requires SEED_MODE_ENABLED=true)
npm test                               # tests/integration/* stop skipping once
                                        # NEXT_PUBLIC_SUPABASE_URL/ANON_KEY point here
```

Then confirm in the Supabase dashboard (Table Editor → RLS column, and
Database → Policies) that every table shows RLS **and** "Forced" enabled,
matching the list above.
