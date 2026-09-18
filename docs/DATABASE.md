# Database

Postgres via Supabase. Six migrations so far, in order — see
docs/MIGRATION_VALIDATION.md for the full validation record:

1. `20260715000000_foundation.sql`
2. `20260716000000_storage.sql`
3. `20260716010000_prevent_privilege_escalation.sql`
4. `20260717000000_leads.sql`
5. `20260718000000_onboarding.sql` (Phase 3)
6. `20260719000000_catalog.sql` (Phase 4)

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
| `onboarding_sessions` (Phase 3) | One onboarding wizard session per tenant; tracks status, current step, completion %. | Yes (`tenant_id`, unique) |
| `onboarding_step_progress` (Phase 3) | Per-step completion marker; source of truth for step locking/resume. | Yes (`tenant_id`) |
| `brand_profiles` (Phase 3) | Name, logo, colors, typography, personality. | Yes (`tenant_id`, unique) |
| `brand_audiences` (Phase 3) | Customer types, age ranges, market type, style preferences. | Yes (`tenant_id`, unique) |
| `brand_product_preferences` (Phase 3) | Categories, launch quantity, design count, price range, sales model. | Yes (`tenant_id`, unique) |
| `production_preferences` (Phase 3) | Method, experience level, workspace, volume, equipment owned. | Yes (`tenant_id`, unique) |
| `budget_profiles` (Phase 3) | Budget band + optional precise total/8-line allocation (checked: allocation sum ≤ total). | Yes (`tenant_id`, unique) |
| `startup_kit_recommendations` (Phase 3) | Deterministic engine output + founder's final selection/override flag. | Yes (`tenant_id`, unique) |
| `storefront_preferences` (Phase 3) | Name, theme, domain status, planned payment methods. | Yes (`tenant_id`, unique) |
| `fulfillment_preferences` (Phase 3) | Model, lead time, shipping regions, return policy, QC. | Yes (`tenant_id`, unique) |
| `launch_readiness_assessments` (Phase 3) | Cached 0–100 score + category breakdown, owner/admin read only. | Yes (`tenant_id`, unique) |
| `garment_templates` (Phase 4) | Garment template; `tenant_id` **nullable** — null = platform-owned shared template, set = tenant-created custom template. | Partial (see docs/GARMENT_TEMPLATES.md) |
| `garment_template_views` / `_colors` / `_sizes` (Phase 4) | Child rows per template; denormalize the parent's `tenant_id` (also nullable). | Partial |
| `garment_print_zones` (Phase 4) | Print-zone position/safe-boundary/supported-methods per template view. | Partial |
| `design_projects` (Phase 4) | A design in progress: status, garment/color/method, owner/assigned designer, notes. | Yes (`tenant_id`) |
| `design_project_versions` (Phase 4) | Immutable jsonb snapshots of a project's normalized state, for restore. | Yes (`tenant_id`) |
| `design_assets` (Phase 4) | Uploaded artwork metadata (dimensions, transparency, checksum); private storage. | Yes (`tenant_id`) |
| `design_elements` / `design_placements` (Phase 4) | The *live* editable state — abstract element + its per-view transform. | Yes (`tenant_id`) |
| `mockups` / `mockup_views` (Phase 4) | Browser-generated digital preview images, never production proofs. | Yes (`tenant_id`) |
| `products` (Phase 4) | Product catalog entry: status, garment/design links, SEO, tags. | Yes (`tenant_id`, unique slug) |
| `product_variants` (Phase 4) | Size/color/style/material/print-location combination + costs/prices. | Yes (`tenant_id`, unique sku + null-safe combo index) |
| `product_images` / `product_design_links` (Phase 4) | Gallery images; product↔design provenance link. | Yes (`tenant_id`) |
| `product_cost_components` (Phase 4) | Per-variant cost line items feeding the pricing engine. | Yes (`tenant_id`) |
| `product_price_history` / `product_status_history` (Phase 4) | Append-only change trails, separate from `audit_logs`. | Yes (`tenant_id`) |

See docs/ONBOARDING.md for the full Phase 3 authorization/resumability
model, and docs/GARMENT_TEMPLATES.md / docs/DESIGN_STUDIO.md /
docs/PRODUCT_CATALOG.md for the Phase 4 tables above. Later-phase tables
are listed in `docs/IMPLEMENTATION_PLAN.md` §4 and will
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
