# Roles and Permissions

## Roles (`lib/auth/roles.ts`, seeded in `supabase/seed/seed.sql`)

| Role key | Scope | Notes |
|---|---|---|
| `platform_super_admin` | Cross-tenant | Also gated by `profiles.is_platform_super_admin`, not just tenant membership — see below. |
| `tenant_owner` | Single tenant | Full control within a tenant. |
| `tenant_admin` | Single tenant | Administrative access within a tenant. |
| `production_manager` | Single tenant | Production jobs, inventory. |
| `designer` | Single tenant | Design projects, mockups. |
| `sales_rep` | Single tenant | Customers, orders, marketing. |
| `support_agent` | Single tenant | Support tickets. |
| `fulfillment_operator` | Single tenant | Shipping, fulfillment. |
| `customer` | Single tenant | Storefront customer — not staff. |

`STAFF_ROLES` = everything except `customer`. `TENANT_ADMIN_ROLES` =
`tenant_owner` + `tenant_admin`.

## Platform Super Admin is two checks, not one

`profiles.is_platform_super_admin` is a separate boolean from tenant
membership. A platform super admin still needs a `tenant_memberships` row
to view a specific tenant's `/app/*` pages (there's no "view any tenant"
bypass in the UI yet); `requirePlatformSuperAdmin()` is what gates
`/admin/*`, independent of any tenant relationship. Do not conflate "is
staff of tenant X" with "is a platform super admin" — they're checked by
different functions (`requireTenantRole`/`requireCurrentTenantRole` vs.
`requirePlatformSuperAdmin`).

## Where checks live

- **Database:** `has_tenant_role(tenant_id, role_keys[])` and
  `is_platform_super_admin()` — used inside RLS policies. This is the real
  boundary; see docs/SECURITY.md.
- **Application:** `lib/auth/session.ts`:
  - `requireTenantRole(tenantSlug, allowedRoles)` — explicit tenant.
  - `requireCurrentTenantRole(allowedRoles)` — the cookie-resolved
    "current" tenant (see docs/ARCHITECTURE.md).
  - `requirePlatformSuperAdmin()` — `/admin/*` gate.
- **Navigation (UX only):** `lib/navigation.ts`'s `NavItem.roles` — hides
  links a role can't use, but the destination route re-checks
  independently. Never treat this list as a security control.

## Adding a new role-gated route

1. Add the route under `app/app/<slug>/page.tsx` or `app/admin/<slug>/page.tsx`.
2. Call `requireCurrentTenantRole([...])` (tenant app) or rely on
   `app/admin/layout.tsx`'s existing `requirePlatformSuperAdmin()` (admin).
3. If the route should be hidden from some roles in the sidebar, add a
   `roles` array to its `NavItem` in `lib/navigation.ts` — but this is
   cosmetic; step 2 is what actually protects it.
4. If the route touches a new table, write its RLS policies before
   writing the query that reads/writes it.
