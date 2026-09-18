# KushPrintCo OS™ — Implementation Plan

This plan translates the KushPrintCo OS build specification into a phased,
reviewable engineering plan for a greenfield repository (see
`docs/CURRENT_STATE.md` for the audit that established there is nothing to
migrate or preserve).

## 1. Chosen Stack

Next.js (App Router) · TypeScript strict · React · Tailwind CSS · shadcn/ui ·
Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form · TanStack
Query · Server Actions/API routes · Vitest · Playwright · npm.

## 2. Repository Layout

```
/app
  /(marketing)                 # public website — section 5
    page.tsx                   # "/"
    how-it-works/
    startup-kits/
    equipment/
    services/
    design-studio/
    academy/
    pricing/
    marketplace/
    about/
    contact/
    terms/
    privacy/
    layout.tsx
  (auth)
    login/
    signup/
  app/                         # authenticated tenant application — section 8
    onboarding/
    brand/
    design-studio/
    mockups/
    products/
    inventory/
    orders/
    production/
    customers/
    storefront/
    marketing/
    analytics/
    startup-kit/
    equipment/
    suppliers/
    academy/
    billing/
    team/
    settings/
    support/
    layout.tsx                # sidebar + topbar shell
  admin/                       # platform admin — section 19
    tenants/ users/ orders/ products/ equipment/ startup-kits/ suppliers/
    courses/ content/ subscriptions/ support/ audit/ settings/ system-health/
    layout.tsx
  store/[tenantSlug]/          # tenant storefront — section 15
    page.tsx
    products/
    products/[productSlug]/
    cart/
    checkout/
    order-confirmation/
  api/                         # route handlers where server actions don't fit
  error.tsx / not-found.tsx / loading.tsx / global-error.tsx

/components
  /ui                          # shadcn/ui primitives
  /marketing                   # homepage sections (announcement bar, hero, etc.)
  /app-shell                   # sidebar, topbar, breadcrumbs, command palette
  /design-studio                # garment viewer + editor
  /commerce                    # cart, checkout, storefront blocks
  /admin

/lib
  /supabase                    # browser + server clients, typed schema
  /auth                        # session helpers, role/permission checks
  /validation                  # zod schemas
  /payments                    # provider-neutral payments abstraction + adapters
  /divinexai                   # service interfaces + mock implementations
  /pricing                     # margin/price calculations (integer minor units)
  env.ts                       # environment variable validation

/supabase
  /migrations
  /seed

/tests
  /unit
  /integration
  /e2e

/docs
```

## 3. Route Map

Public: `/`, `/how-it-works`, `/startup-kits`, `/equipment`, `/services`,
`/design-studio`, `/academy`, `/pricing`, `/marketplace`, `/about`,
`/contact`, `/login`, `/signup`, `/terms`, `/privacy`.

Authenticated app: `/app`, `/app/onboarding`, `/app/brand`,
`/app/design-studio`, `/app/mockups`, `/app/products`, `/app/inventory`,
`/app/orders`, `/app/production`, `/app/customers`, `/app/storefront`,
`/app/marketing`, `/app/analytics`, `/app/startup-kit`, `/app/equipment`,
`/app/suppliers`, `/app/academy`, `/app/billing`, `/app/team`,
`/app/settings`, `/app/support`.

Storefront: `/store/[tenantSlug]`, `/store/[tenantSlug]/products`,
`/store/[tenantSlug]/products/[productSlug]`, `/store/[tenantSlug]/cart`,
`/store/[tenantSlug]/checkout`, `/store/[tenantSlug]/order-confirmation`.

Admin: `/admin`, `/admin/tenants`, `/admin/users`, `/admin/orders`,
`/admin/products`, `/admin/equipment`, `/admin/startup-kits`,
`/admin/suppliers`, `/admin/courses`, `/admin/content`,
`/admin/subscriptions`, `/admin/support`, `/admin/audit`, `/admin/settings`,
`/admin/system-health`.

## 4. Database Model (summary)

All tenant-owned tables carry `tenant_id uuid not null references tenants(id)`,
`created_at`, `updated_at`, and default-deny RLS. Full DDL lives in
`supabase/migrations/`; delivered incrementally per phase, not all at once.

**Phase 1 (foundation) tables:** `profiles`, `tenants`, `tenant_memberships`,
`roles`, `permissions`, `role_permissions`, `audit_logs`.

**Phase 3+ tables:** `tenant_brand_settings`, `onboarding_sessions`, `brands`.

**Phase 4 tables:** `design_projects`, `design_assets`, `design_elements`,
`garment_templates`, `products`, `product_variants`, `product_images`.

**Phase 5 tables:** `inventory_items`, `inventory_movements`, `customers`,
`customer_addresses`, `orders`, `order_items`, `order_status_history`,
`storefronts`, `storefront_blocks`, `carts`, `cart_items`, `discounts`.

**Phase 6 tables:** `production_jobs`, `production_job_events`.

**Phase 7 tables:** `suppliers`, `equipment_categories`, `equipment`,
`startup_kits`, `startup_kit_items`, `courses`, `course_modules`, `lessons`,
`enrollments`, `lesson_progress`.

**Phase 8 tables:** `campaigns`, `leads`, `subscriptions`, `plans`,
`plan_entitlements`, `support_tickets`, `notifications`, `file_assets`,
`system_events`.

This staged ordering matches section 20 of the spec but sequences table
creation with the phase that actually needs it, so every migration ships
with working code that exercises it (per the "no fake integrations" rule).

## 5. Component Hierarchy (top level)

```
RootLayout
├── MarketingLayout
│   ├── AnnouncementBar
│   ├── PrimaryNav
│   ├── {page sections}
│   └── Footer
├── AuthLayout (login/signup)
├── AppShellLayout (authenticated tenant app)
│   ├── Sidebar (role-aware nav)
│   ├── Topbar (global search, notifications, tenant switcher, command palette)
│   ├── Breadcrumbs
│   └── {route content}
├── AdminLayout
│   ├── AdminSidebar
│   └── {route content}
└── StorefrontLayout
    ├── StorefrontHeader (tenant brand)
    ├── StorefrontBlocks (configurable content blocks)
    └── StorefrontFooter
```

Shared primitives (`components/ui`) are shadcn/ui-based and tenant-agnostic;
no KushPrintCo-specific copy or branding is hardcoded into them — tenant
branding is injected via `tenant_brand_settings` at render time.

## 6. Phase Plan (execution order)

| Phase | Deliverable | Status |
|---|---|---|
| 0 | Repository audit + this plan | **Complete** |
| 1 | App shell, design system, auth, tenant/membership/role model, RLS, env validation, error boundaries | **Complete** |
| 1.5 | Supabase validation hardening (security fixes, storage RLS, tenant provisioning, audit logging) | **Complete (implementation) — live verification blocked on Supabase project access, see docs/SECURITY.md** |
| 2 | Public marketing website | **Complete** |
| 3 | Onboarding + brand setup | Partially started (tenant-creation step of onboarding shipped in Phase 1.5; the full multi-step wizard is still open) |
| 4 | Product + design studio | Not started |
| 5 | Commerce + storefront | Not started |
| 6 | Production operations | Not started |
| 7 | Equipment + academy | Not started |
| 8 | White-label + admin | Not started |
| 9 | Hardening (tests, a11y, security, perf, docs, deployment) | Not started |

Each phase ends with the Required Phase Report (files created/modified,
DB changes, features completed, tests added/passed, remaining risks,
credentials still required, next recommended phase).

## 7. Risk Register

See `docs/CURRENT_STATE.md` §5 — carried forward and updated at the end of
every phase rather than duplicated here.

## 8. Compatibility Assessment

No existing stack to be compatible with; the recommended stack is adopted
as-is (see `docs/CURRENT_STATE.md` §4).
