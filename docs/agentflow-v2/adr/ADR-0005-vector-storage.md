# ADR-0005: Vector Storage

**Status:** Proposed — to be implemented in Phase 3

## Context

The Business Memory Engine (§VII) requires semantic retrieval over
`memory_chunks`. A dedicated vector database is one option; embedding the
capability in the primary database is another.

## Decision

Use `pgvector` inside the same Supabase Postgres instance used for the rest
of the schema (see ADR-0001), rather than a separate vector database.
`memory_chunks` carries a `vector` column indexed with `pgvector`'s
approximate-nearest-neighbor index types.

## Consequences

- One fewer operational dependency and no cross-database consistency problem
  between relational memory metadata (trust state, access policy, tenant
  ownership) and its embeddings — a single transaction can update both.
- If embedding volume or query latency later exceeds what `pgvector`
  comfortably handles, migrating to a dedicated vector database is a future
  ADR, gated on that evidence rather than anticipated now.
