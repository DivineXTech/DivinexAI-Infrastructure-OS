# Garment Templates (Phase 4)

## Ownership model

`garment_templates.tenant_id` is **nullable**, and that nullability *is*
the ownership model:

- `tenant_id is null` → a **platform-owned, shared template** — readable
  by any active member of any tenant, writable only by a platform super
  admin.
- `tenant_id` set → a **tenant-created custom template** — readable and
  writable only by that tenant's `tenant_owner`/`tenant_admin`, invisible
  to every other tenant.

Four child tables (`garment_template_views`, `garment_template_colors`,
`garment_template_sizes`, `garment_print_zones`) denormalize the same
`tenant_id` from their parent template rather than requiring a join for
RLS or for the application layer's explicit tenant-scoped queries — the
same "every query resolves its own tenant scope, never trusts RLS breadth
alone" contract every other tenant-owned table in this codebase follows.
Uniqueness is enforced with two partial unique indexes (`slug` unique
among platform templates; `(tenant_id, slug)` unique among custom ones),
since a plain `unique(tenant_id, slug)` constraint wouldn't catch
duplicate platform-template slugs — Postgres treats every `NULL` in a
unique index as distinct from every other `NULL`.

## Categories

`t_shirt`, `long_sleeve_shirt`, `hoodie`, `sweatshirt`, `polo`, `tank_top`,
`hat`, `workwear`, `athletic_apparel`, `childrens_apparel`, `bag`,
`promotional_item` — a closed `check` constraint, matching section 3.

## Print-zone coordinate model

Every `garment_print_zones` row (`x, y, width, height, safe_width,
safe_height`) is a **percentage (0–100) of its garment view's canvas**,
not an absolute pixel position. This makes a zone's coordinates
resolution-independent — the same zone definition applies whether the
underlying view is a 400px placeholder SVG or a 4000px photograph, and
`lib/catalog/print-zone-validation.ts`'s boundary checks work identically
either way. Design elements (`design_placements.x/y/width/height`) use
the exact same percentage space, so checking "is this element inside the
zone's safe area" is a plain rectangle comparison — no unit conversion,
no DPI lookup, no per-view special-casing.

The safe-print boundary is centered within the zone
(`safeBoundaryRect` in `lib/catalog/print-zone-validation.ts`) and
defaults to the full zone when no narrower safe area is configured.
`printZoneBoundaryWarnings` returns "extends outside the print zone
entirely" (worse) or "extends outside the safe-print boundary" (milder)
— the editor surfaces whichever applies, per section 5's "must prevent or
warn."

## Garment-view adapter

`components/garment-preview/adapter.ts` defines the rendering contract
(`GarmentPreviewAdapter = ComponentType<{ view, colorHex }>`).
`Layered2dAdapter` (`components/garment-preview/layered-2d-adapter.tsx`) is
the only implementation in this phase: it renders either an uploaded flat
image or inline SVG using `currentColor`, so the same silhouette recolors
for every garment color via a single CSS property. `GarmentViewer`
(`components/garment-preview/garment-viewer.tsx`) owns all interaction
state — active view, simulated rotation, zoom, pan, fullscreen, touch
swipe, keyboard controls, reduced-motion — and only delegates "draw this
view" to whichever adapter is passed in. A future WebGL/Three.js adapter
means implementing this one interface; the viewer's interaction logic
never has to change.

**What this is not**: a 2D layered SVG/image preview is not photorealistic
3D rendering, and nothing in this codebase describes it that way. Every
place it's shown is labeled "interactive garment preview."

## Seed data

`supabase/seed/seed.sql` inserts three platform-owned generic templates
(t-shirt, hoodie, sweatshirt) with 5 sizes, 3 colors, 4 rotation views
(front/back/left/right, original inline SVG silhouettes — simple rounded
shapes, not an attempt at photorealistic garment art), and 3 print zones
each. No third-party product photography or brand marks, per section 19.
