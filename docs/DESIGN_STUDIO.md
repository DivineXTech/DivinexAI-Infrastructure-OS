# Design Studio (Phase 4)

A functional MVP garment design editor: select a template/color/view/print
zone, add text and uploaded artwork, position/resize/rotate/lock/hide/
duplicate/delete/reorder elements, undo/redo, autosave, version snapshots
and restore, submit for review, approve, and convert an approved design
into a product draft.

## Routes

| Route | Purpose |
|---|---|
| `/app/design-studio` | List of design projects with status. |
| `/app/design-studio/new` | Create a project (name only — garment/color chosen in the editor). |
| `/app/design-studio/[projectId]` | The editor. |
| `/app/design-studio/[projectId]/preview` | Read-only preview across every view, plus mockup generation. |

## Editor architecture

The persisted project is **normalized data, not canvas-library objects** —
this is the explicit architectural caution for this phase. The format
(`lib/design-studio/project-schema.ts`, Zod-validated):

```ts
type DesignProjectState = {
  garmentTemplateId: string | null;
  garmentColorId: string | null;
  activeView: "front" | "back" | "left" | "right";
  elements: DesignElement[]; // { id, elementType, zIndex, locked, hidden,
                             //   text*, designAssetId, placement }
};
```

`placement` (`x, y, width, height, rotation`) is a percentage of the
garment view's canvas — the same coordinate space `garment_print_zones`
uses (see docs/GARMENT_TEMPLATES.md), so an element's position can be
checked against a zone's safe boundary with no unit conversion.

**Undo/redo** (`lib/design-studio/history-reducer.ts`) is a pure reducer
over this same state — `applyDesignAction` never touches I/O, a canvas
instance, or the DOM. `dispatchDesignAction`/`undo`/`redo` manage a
`{ past, present, future }` stack bounded to `MAX_HISTORY_DEPTH` (50)
entries (section 22's "bounded project history retrieval") so a long
editing session doesn't grow the in-memory stack unbounded.

**Rendering** is a separate layer (`components/design-studio/design-canvas.tsx`,
`element-inspector.tsx`, `layer-list.tsx`) that reads the normalized state
and renders positioned `<button>`/`<div>` overlays — no canvas library
(Fabric.js/Konva/etc.) is used or required by the data model. A future
richer editor could replace this rendering layer entirely without
touching `project-schema.ts`, `history-reducer.ts`, or the database
schema — that's the point of keeping them decoupled.

**Accessibility**: every element's position/size/rotation is also a plain
numeric `<input>` in `ElementInspector` — pointer-drag on the canvas is a
convenience layered on top, never the only way to move or resize
something (section 21). Layer reordering is explicit "move up"/"move
down" buttons, not drag-to-reorder, for the same reason.

## Versioning vs. undo/redo

Two different mechanisms, serving different purposes:

- **Undo/redo** is in-memory, per-editing-session, and lost on page reload
  — it's for "I made a mistake three clicks ago."
- **Versions** (`design_project_versions`) are durable, named snapshots of
  the *live* state (`design_elements`/`design_placements`), created
  explicitly ("Save version") or automatically when restoring an older
  version (the restore itself becomes a new version, so restoring is
  never a destructive rewrite of history). `design_projects.current_version_id`
  points at the most recent snapshot.

Autosave (`saveDesignStateAction`) writes only to the live
`design_elements`/`design_placements` tables — it does not create a
version on every autosave tick, so autosave and version history don't
inflate each other. Autosave is debounced 2.5s after the state settles,
never fired on every pointer movement (section 22).

## Artwork uploads

See docs/ARTWORK_SECURITY.md for the full upload pipeline (MIME
validation, SVG sanitization, dimension/transparency extraction, signed
URLs, duplicate-file dedup by checksum).

## Approved font list

A closed set (`lib/design-studio/fonts.ts`) — five generic CSS font-stack
keys (sans/serif/mono/bold display/script), no arbitrary font uploads or
remote font URLs. Nothing in the editor can load an external resource
through a font selection.

## Design project workflow

Statuses: `draft` → `needs_artwork` → `ready_for_review` → (`changes_requested`
→ `ready_for_review` again, or) `approved` → `converted_to_product`, or
`archived` from most states. `owner_profile_id`/`assigned_designer_id`,
`internal_notes`/`customer_notes`, and `created_from` (`manual` vs.
`onboarding`) are tracked on `design_projects`.

Authorization (`lib/design-studio/guard.ts`):

- `tenant_owner`/`tenant_admin`/`designer` — create/edit/upload/submit.
- `tenant_owner`/`tenant_admin` only — approve or request changes
  (`requireDesignApprovalAccess`). A designer can never self-approve;
  there is no code path that grants it.
- `production_manager` — read-only, and RLS additionally narrows that to
  `approved`/`converted_to_product` projects only (never drafts or
  in-review work) — see `supabase/migrations/20260719000000_catalog.sql`.

## Mockup limitations

Mockups are generated **entirely in the browser** — there is no
server-side image renderer in this phase (no `sharp`/headless-Chromium
rendering service). `lib/design-studio/mockup-compose.ts` builds a pure
SVG string per view (garment background + text elements, positioned in
the same percentage coordinate space), and
`components/design-studio/mockup-generate-button.tsx` rasterizes it via
the Canvas API (`Image` → `<canvas>` → `toDataURL("image/png")`), then
uploads the PNG through a Server Action.

**Known limitation, disclosed rather than hidden:** image elements
currently render as a dashed placeholder outline in the generated
mockup, not the actual uploaded artwork pixels. Embedding a private,
signed-URL-backed cross-origin image into an SVG that's then rasterized
via canvas risks a "tainted canvas" (the browser refuses `toDataURL()` on
canvases that drew cross-origin image data without proper CORS headers).
Text elements render accurately. Every mockup is labeled a "digital
preview" everywhere it's shown (`/app/mockups`, the preview page, the
print-friendly view) and is never presented as a production proof.

## Print-quality warnings

See docs/ARTWORK_SECURITY.md and docs/GARMENT_TEMPLATES.md — the DPI/
transparency/production-method warnings shown in `ElementInspector` come
from `lib/catalog/artwork-quality.ts` and `lib/catalog/print-zone-validation.ts`,
both pure and unit-tested.
