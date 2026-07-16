# Product Catalog (Phase 4)

## Routes

| Route | Purpose |
|---|---|
| `/app/products` | List, filtered by what RLS/the guard allow the caller to see. |
| `/app/products/new` | Create a product draft (name, category, garment template, production method). |
| `/app/products/[productId]` | Overview + status transitions. |
| `/app/products/[productId]/edit` | Descriptions, SEO fields, tags. |
| `/app/products/[productId]/variants` | Size/color matrix generator + variant list. |
| `/app/products/[productId]/pricing` | Per-variant cost components and margin (docs/PRICING_ENGINE.md). |

## Status transitions

`draft → ready_for_review → approved → active ⇄ paused → archived`
(`products.status` check constraint,
`supabase/migrations/20260719000000_catalog.sql`). Every transition is
recorded in `product_status_history` (`from_status`, `to_status`,
`changed_by`) — an append-only audit trail independent of `audit_logs`,
kept because it's queried differently (per-product timeline vs.
tenant-wide privileged-action log).

**Activation gating** (section 11: "Product activation must be blocked
when required fields or variants are missing"):
`lib/catalog/product-activation.ts`'s `checkProductActivation` is a pure
function — name present, a production method selected, at least one
variant exists, and at least one variant has a retail price set. All
missing requirements are reported at once, not just the first one hit.
`updateProductStatusAction` (`app/app/products/actions.ts`) calls this
before allowing a transition to `active` and returns every missing
requirement as the error message otherwise — the transition simply
doesn't happen; there's no partial-activation state.

## Variants

`product_variants` supports size, color, garment style, material, and
print location as independent dimensions. `lib/catalog/variant-matrix.ts`
(pure, unit-tested) generates the cartesian product of whichever
dimensions the founder provides — a dimension with no values contributes
a single "unset" slot rather than zeroing out the whole matrix (so
"sizes only, no colors" still produces one variant per size).

**Duplicate prevention is two layers deep**:
1. Application layer: `findDuplicateCombinations`/`isDuplicateCombination`
   check the candidate matrix before any insert is attempted.
2. Database layer: `product_variants_combo_idx`, a null-safe expression
   unique index (`coalesce(size_label, ''), coalesce(color_name, ''), ...`)
   — the last-resort backstop if the application check is ever bypassed.
   `combinationKey()` in `variant-matrix.ts` matches this expression
   exactly, so "is this a duplicate" is answered identically in both
   places.

## Design-to-product conversion

`app/app/design-studio/convert-actions.ts`'s `convertDesignToProductAction`:

1. Requires an **approved** design project and catalog-edit access
   (`tenant_owner`/`tenant_admin`).
2. **Idempotent**: checks `product_design_links` first — if this design
   is already linked to a product (from a prior conversion), returns that
   product's id instead of creating a duplicate. Safe to click twice, or
   to retry after a network failure mid-request.
3. Copies the garment template, color, and production method from the
   design onto the new product.
4. Generates an initial variant matrix from the linked garment template's
   sizes/colors, if one is set.
5. Attaches the design's most recent mockup as the product's primary
   image, if one exists.
6. Transitions the design project to `converted_to_product`.
7. Writes a `product.created` audit log entry with the source design id
   in its metadata.

## Roles

- `tenant_owner`/`tenant_admin` — full product/variant/pricing read+write
  (`lib/catalog/guard.ts`'s `requireCatalogEditAccess`).
- `sales_rep` — read-only, and only on `active` products/variants/images
  (RLS-enforced; never sees drafts or internal notes).
- `production_manager` — read-only on variants/cost components
  ("production specifications") for `approved`/`active` products only.
- Everyone else — denied (`requireCatalogReadAccess` logs a
  `privileged_action.denied` entry for a disallowed role attempting the
  read-gated list/detail pages).

The spec's "sales rep can draft descriptions if entitled" is **not**
implemented as a distinct write grant in this phase — see
docs/TECH_DEBT.md for why (same deferral rationale as Phase 3's
"Authorized manager" tier).
