# Database

Postgres via Supabase. Four migrations so far, in order — see
docs/MIGRATION_VALIDATION.md for the full validation record:

1. `20260715000000_foundation.sql`
2. `20260716000000_storage.sql`
3. `20260716010000_prevent_privilege_escalation.sql`
4. `20260717000000_leads.sql`

## Tables

| Table | Purpose | Tenant-scoped? |
|---|---|---|
| `profiles` | One row per Supabase `auth.users` row. Auto-created by the `on_auth_user_created` trigger. | No (platform identity) |
| `tenants` | A KushPrintCo OS tenant (KushPrintCo itself, or a white-label operator). | — (this *is* the tenant table) |
| `roles` | Platform-defined RBAC roles (see docs/ROLES_AND_PERMISSIONS.md). | No |
| `permissions` | Reserved for future fine-grained entitlements. | No |
| `role_permissions` | Join table, `roles` ↔ `permissions`. | No |
| `tenant_memberships` | Join table, `profiles` ↔ `tenants`, with a `role_id`. This is what every RLS policy below joins through. | Yes (`tenant_id`) |
| `audit_logs` | Append-only privileged-action trail. | Yes (`tenant_id`, nullable for platform-level actions) |
| `leads` (Phase 2) | Public lead-capture submissions (contact, consultation, kit/equipment/white-label interest, early access). | No (pre-tenant; submitted by anonymous visitors) |

Later-phase tables are listed in `docs/IMPLEMENTATION_PLAN.md` §4 and will
ship as their own migrations when the corresponding phase starts — this
keeps every migration paired with code that actually exercises it.

## Conventions

- Every tenant-owned table has a `tenant_id uuid not null references
  tenants(id)`.
- `created_at` / `updated_at timestamptz` on every mutable table;
  `updated_at` is maintained by the `set_updated_at()` trigger, not
  application code.
- Soft-delete: `tenants.deleted_at` is the pattern to follow for future
  tables that need it (nullable timestamp, filtered out of default
  queries/indexes rather than physically deleted).
- All monetary values in later-phase tables (products, orders, etc.) must
  be integer minor units (cents), never floats — see
  `docs/IMPLEMENTATION_PLAN.md` and the spec's product/pricing sections.

## Helper functions (used by RLS, not application code directly)

- `is_platform_super_admin()` — reads the caller's own `profiles` row.
- `is_tenant_member(tenant_id)` — active membership check.
- `has_tenant_role(tenant_id, role_keys[])` — active membership + role check.

All three are `security definer` with `search_path = public` pinned, and
are intentionally minimal (no parameters beyond what's needed) since they
run on every RLS-checked query.

## Regenerating TypeScript types

`lib/supabase/types.ts` is **hand-written** to match the migration above —
there's no linked Supabase project in this environment to run the
generator against. Once one exists:

```bash
supabase gen types typescript --linked > lib/supabase/types.ts
```

Keep the hand-written file's `Relationships: []` entries if you ever go
back to hand-editing — `@supabase/postgrest-js`'s `GenericTable` type
requires a `Relationships` array per table (even if empty) or column types
resolve to `never` instead of failing to compile, which is a much more
confusing error to debug.

## Local development

```bash
supabase start          # local Postgres + Auth + Storage
supabase db reset       # applies migrations/ then seed/seed.sql
npm run seed            # creates demo auth users + memberships (scripts/seed.ts)
```

`supabase db reset` and `npm run seed` are both explicitly dev-only — see
docs/DEPLOYMENT.md for what must never run against production.
