# Artwork Security (Phase 4)

Design artwork upload (`app/app/design-studio/artwork-actions.ts`) is the
one upload path in this codebase that accepts SVG — every other bucket
(logos, brand assets, product images) still deliberately excludes
`image/svg+xml`, per the Phase 1.5 stored-XSS rationale in docs/SECURITY.md.
This document is the compensating-control record that justifies the
narrower exception.

## Never trust the extension or claimed MIME type

`uploadArtworkAction` rejects anything outside `image/png`, `image/jpeg`,
`image/webp`, `image/svg+xml` by the browser-reported `file.type` first,
but that check alone is not the security boundary:

- **PNG/JPEG/WebP**: `lib/catalog/image-dimensions.ts` reads the file's
  actual binary header (PNG signature + IHDR, JPEG SOI/SOF0 markers, WebP
  RIFF/VP8X/VP8L/VP8 chunks) to extract width/height/transparency. A file
  that claims to be a PNG but isn't returns `null` from this reader — it's
  stored anyway (this phase doesn't hard-reject malformed rasters, since a
  corrupt-but-harmless image is a UX problem, not a security one), but no
  code path trusts unverified dimensions for print-quality math.
- **SVG**: sanitized *before a single byte reaches storage*, never after.

## SVG sanitization — what this does and does not guarantee

`lib/catalog/svg-sanitizer.ts`'s `sanitizeSvgMarkup` is a **denylist-based
regex sanitizer**, not a full XML-aware parser or an allowlist-based one
(no `DOMPurify`/`sanitize-html`-equivalent dependency is available in this
project). It:

1. Requires the input to structurally look like a well-formed `<svg>...</svg>`
   document (optional XML prolog/DOCTYPE, nothing else) — anything else is
   rejected outright (`safe: false`), not stored with a warning.
2. Strips `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`,
   and `<animate>` elements entirely.
3. Strips every `on*` event-handler attribute (`onload`, `onclick`, etc.,
   both quote styles) and any `javascript:` URI anywhere in the markup.
4. Neutralizes every `href`/`xlink:href` that isn't a same-document
   fragment reference (`#id`) — blocks remote resource loading and
   `data:` URIs that could smuggle a script.

**Honest limitation**: a regex-based pass over untrusted markup cannot
provide the same guarantee as a real parser walking a DOM tree (an
attacker with enough creativity around malformed/nested markup could in
principle construct an edge case the patterns above don't catch — the
classic weakness of any denylist). This is the pragmatic choice for this
phase given no suitable sanitization library is currently a project
dependency; upgrading to a proper allowlist-based DOM sanitizer (e.g. if
`dompurify` + a DOM implementation becomes available) is recorded in
docs/TECH_DEBT.md as the natural hardening step. The sanitizer is
re-applied at **render time** too (`Layered2dAdapter`), not just at
upload time, so a custom tenant-created garment template's inline SVG
(less trusted than platform-curated templates) gets the same treatment
every time it's displayed.

## Storage

- Bucket: `design-uploads` (private, not public-read) — the only bucket
  whose `allowed_mime_types` was extended to include `image/svg+xml` and
  `image/webp` (see the comment in
  `supabase/migrations/20260719000000_catalog.sql` "Storage: allow
  sanitized SVG + WebP"). No other bucket's MIME allowlist changed.
- Path convention: `{tenantId}/design-assets/{timestamp}-{sanitized-filename}`,
  built via the existing `buildTenantObjectPath`/`sanitizeFilename`
  helpers (`lib/storage/paths.ts`) — same path-traversal and
  cross-tenant-write protections every other bucket already has.
- All reads go through a **10-minute signed URL**
  (`getArtworkSignedUrlAction`), never a public bucket URL — the bucket
  stays private.
- Size limit: 25 MB (matches the bucket's existing `file_size_limit`).

## Duplicate detection and replacement

Every upload is checksummed (`SHA-256` over the *post-sanitization* bytes,
via `crypto.subtle.digest`) and checked against `design_assets.checksum`
for the tenant before a new object is written — re-uploading the same
file (or the same SVG that sanitizes to the same output) reuses the
existing asset row rather than duplicating storage. "Replace" is
implemented as upload-then-retire (`replaceArtworkAction`): a new asset is
uploaded and the old one is marked `status = 'replaced'`, never
overwritten in place, so a design mid-edit that still references the old
asset id isn't silently changed underneath it.

## What this does not cover

- Malware/virus scanning of uploaded binaries is out of scope for this
  phase (no such scanning service is integrated anywhere in the codebase
  yet).
- PDF preview placeholder (an optional format per section 7) is not
  implemented in this phase.
- Live storage-isolation and SVG-acceptance behavior described above is
  implemented and covered by
  `tests/integration/catalog-isolation.test.ts` ("design artwork storage
  isolation"), which — like every other integration test in this
  project — skips rather than passes without a live Supabase project and
  service-role key. See docs/TESTING.md.
