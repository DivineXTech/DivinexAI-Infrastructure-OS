# ADR-0001: Application Stack Selection

**Status:** Accepted (2026-07-21); tooling addendum added after house
convention review (2026-07-21)

## Context

`divinexai-infrastructure-os` is greenfield (see `../REPOSITORY_AUDIT.md`) —
no framework, database, or hosting target is established. AgentFlow Pro v2
requires: a business-facing web UI plus a separate admin/developer view
(§I/§XVI of the source brief), server-enforced multi-tenant isolation via
"row-level security or equivalent" (§XV), and a data model with ~60 tables
across seven domains (§V) that will grow incrementally across nine phases.

## Decision

- **Language:** TypeScript across frontend, backend, and workers.
- **Framework:** Next.js (App Router), with route groups separating the
  business-user surface from admin/developer/executive views.
- **Database:** Supabase Postgres — native Row-Level Security satisfies the
  tenant-isolation requirement directly, and Supabase bundles auth and file
  storage (needed for memory-source ingestion) without adding separate
  vendors for each.
- **Vector store:** `pgvector` inside the same Postgres instance rather than
  a dedicated vector database.
- **Monorepo layout:** one `packages/*` per architectural module (agent
  runtime, memory engine, tool registry, workflow engine, governance, Sara,
  vertical-OS SDK, observability), so provider- and vendor-specific code is
  isolated by folder boundary, not just convention.

## Consequences

- RLS policies must be written and tested for every tenant-owned table from
  migration 0001 onward — there is no legacy data to be lenient about.
- Supabase becomes a real dependency for auth/storage/Postgres; if that
  proves wrong later, the migration cost is real (though the domain schema
  itself, being plain Postgres/SQL, is portable to any Postgres host).
- pgvector keeps operational surface area small at current scale; if
  retrieval volume or embedding dimensionality later demands a dedicated
  vector database, that's a future ADR, not a blocker now.

## Alternatives considered

- A separate vector database (Pinecone/Weaviate) — rejected for now as an
  unnecessary second data store before real retrieval volume exists.
- A non-TypeScript backend (e.g., a separate Python service for the agent
  runtime) — rejected to keep types shared end-to-end across API and UI;
  can be revisited if a specific provider SDK is Python-only.

## Addendum: house convention review (2026-07-21)

A read-only inspection of `DivineXTech/-MediaForgeOS` (a real, current
production sibling app) and `DivineXTech/afrogrow360-core` (greenfield) was
performed per the precedence order: AgentFlow Pro's own conventions >
MediaForgeOS > afrogrow360-core > documented DivinexAI standards > new
conventions. Full detail in `../HOUSE_CONVENTION_REVIEW.md`. Net effect on
this ADR:

**Adopted from MediaForgeOS** (no prior AgentFlow Pro convention existed for
these, so the tier-2 house convention applies):

- Package manager: **Bun**.
- Monorepo tool: **Turborepo**, with `apps/*` + `packages/*` workspaces —
  compatible with, and now the concrete implementation of, the `packages/*`
  module layout already decided above.
- Validation library: **Zod**, used for both environment-variable parsing and
  agent/tool/workflow schema validation (§VI.6, §IX of the source brief).
- Env var convention: one Zod-validated `env.ts` per app/package (parse once,
  export a typed `env` object), with a commented `.env.example` at the repo
  root and per app/package — reused verbatim from
  `apps/backend/src/env.ts` in MediaForgeOS.
- CI platform: **GitHub Actions**, confirmed as the house standard
  independent of deploy target.

**Rejected, in favor of this ADR's existing (tier-1) decisions** — these are
real MediaForgeOS conventions but conflict with AgentFlow Pro's own,
already-approved stack, which outranks a sibling repo's convention:

- Vite + React SPA frontend, and Express backend → superseded by Next.js
  (App Router), reinforced weakly by afrogrow360-core's README stating a
  Next.js intent for its own product.
- `better-auth` → superseded by Supabase Auth (bundled with the chosen
  database).
- Prisma ORM → superseded by raw SQL migrations via the Supabase CLI, since
  Prisma has no first-class Row-Level Security policy management and would
  work against the RLS-centric tenant-isolation model in `ADR-0003`.
- Self-hosted MinIO object storage → superseded by Supabase Storage.
- MediaForgeOS's uncommitted/dev-push-only migration history → rejected
  outright regardless of stack, since it conflicts with the source brief's
  requirement for versioned, reversible migrations with rollback
  instructions per phase.
- Docker images deployed to Kubernetes/ArgoCD → superseded by the explicit,
  current working assumption of Vercel + Supabase (see `ADR-0011`).

Neither sibling repo offered a multi-tenant/RLS convention (MediaForgeOS is
single-tenant B2C; afrogrow360-core has no code) or a test-framework
convention (MediaForgeOS ships no automated tests) — those remain new
conventions, covered by `ADR-0003` and the new `ADR-0012` respectively.
