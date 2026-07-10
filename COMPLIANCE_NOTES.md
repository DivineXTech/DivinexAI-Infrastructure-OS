# Compliance notes

**This platform is not represented as legally compliant in any
jurisdiction merely because the pages below exist.** This document lists
what exists today and what still needs qualified legal review before any
real launch.

## What exists

- `/legal/terms`, `/legal/privacy`, `/legal/refunds`,
  `/legal/creator-agreement`, `/legal/buyer-terms`,
  `/legal/acceptable-use`, `/legal/copyright` — all render **placeholder
  content** (`app/(marketing)/legal/[document]/page.tsx`) with a visible
  warning banner stating they are not legal advice and haven't been
  reviewed by counsel.
- Seller verification status field (`seller_verifications.status`) and an
  admin review workflow — a data model for KYC-style verification, not an
  identity-verification integration.
- Consent scaffolding for future subscriber/marketing features
  (`subscriber_consents` table captures `consent_source` and
  `consented_at`) — unused until Phase 3 ships subscriber collection.

## What requires legal review before production launch

- **Terms of Service, Privacy Policy, Creator Agreement, Buyer Terms,
  Refund Policy, Acceptable Use Policy** — currently placeholder text only.
  Must be drafted or reviewed by counsel qualified in each operating
  jurisdiction before real transactions occur.
- **Tax information collection** — no tax ID/VAT collection exists for
  creators or automated tax withholding calculation. `ledger_entries`
  supports a `tax_withholding` entry type at the schema level, but no
  logic populates it.
- **Sanctions screening** — no integration exists. Required before enabling
  real payouts in any jurisdiction where OFAC/EU/UK sanctions regimes
  apply.
- **Age requirements** — no age-gating or age-verification exists anywhere
  in the product.
- **Restricted products policy** — the product moderation workflow
  (`/admin/moderation`) is manual and general-purpose; no automated
  restricted-category detection exists.
- **Regional data considerations** (e.g. NDPR in Nigeria, POPIA in South
  Africa, GDPR for EU/UK buyers) — Supabase project region selection and
  any data residency commitments are an infrastructure decision outside
  this codebase; this document does not make a determination about which
  regime applies or how to satisfy it.
- **Copyright complaint process** — the `/legal/copyright` page is a
  placeholder; no functioning DMCA-style intake or takedown workflow
  exists (the `reports` table can represent a report against a product,
  but no dedicated copyright-complaint flow is built on top of it).
- **Data deletion / data export requests** — no self-service or
  admin-initiated user data export/deletion flow exists yet.

## Recommendation

Treat every item above as a blocking legal/compliance dependency for a
real (non-demo) launch, tracked independently of the engineering roadmap
in ROADMAP.md.
