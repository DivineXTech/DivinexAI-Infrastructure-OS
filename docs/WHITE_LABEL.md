# White-Label

Not built yet — this is Phase 8 per `docs/IMPLEMENTATION_PLAN.md`. Recorded
here so the eventual design has an anchor point.

## What exists today that white-label will build on

- **Tenant model** (`tenants` table): `slug`, `name`, `status`. White-label
  configuration (logo, favicon, colors, typography, support contact,
  domain, sender identity, legal pages, pricing, feature entitlements,
  equipment/kit/training catalogs, marketplace commission, payment config,
  powered-by attribution) will extend this via a `tenant_brand_settings`
  table (Phase 3) plus new tables for plans/entitlements (Phase 8) — see
  `docs/DATABASE.md` and `docs/IMPLEMENTATION_PLAN.md` §4.
- **Role model**: already includes every role the spec lists
  (`docs/ROLES_AND_PERMISSIONS.md`), so white-label tenants don't need a
  different role system, just their own membership rows.
- **No tenant-specific content is hardcoded** in reusable platform code —
  `app/(marketing)` and `app/app` contain "KushPrintCo OS" branding at the
  chrome level (nav brand text) but no tenant-specific business content;
  actual tenant branding will be read from `tenant_brand_settings` and
  injected at render time once that table exists, not edited into
  component source per-tenant.

## Deliberately deferred

Multi-domain routing, per-tenant theming injection, plan/entitlement
gating, and the white-label admin console (`/admin/subscriptions`,
`/admin/tenants` beyond a placeholder) are all unbuilt. Do not assume any
of them work.
