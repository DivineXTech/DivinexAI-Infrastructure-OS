# ADR-0001: Application Stack Selection

**Status:** Accepted (2026-07-21)

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
