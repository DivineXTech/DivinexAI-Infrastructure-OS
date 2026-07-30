# ADR-0003: Multi-Tenant Isolation via Postgres RLS

**Status:** Implemented (Phase 1, 2026-07-21) — see `../PHASE_1_TENANCY.md`
for the schema, policies, and test results

## Context

AgentFlow Pro is multi-tenant from its first table. The source brief
requires isolation enforced server-side, never trusting a tenant ID supplied
only by the client (rule #8), with "row-level security or equivalent."

## Decision

- Every tenant-owned table includes `tenant_id uuid not null references
tenants(id)`.
- Row-Level Security is enabled on every such table, with a single shared
  policy pattern that derives the active tenant from the authenticated
  session (via a `tenant_memberships` lookup keyed on `auth.uid()`), never
  from a request header, query parameter, or JSON body field.
- API/service-layer code additionally re-validates tenant membership before
  performing writes — RLS is the last line of defense, not the only one,
  since some operations (background workers, service-role queries) run
  outside the request's RLS context and must enforce tenant scoping in
  application code instead.
- A shared test helper asserts, for every new tenant-owned table, that a
  session authenticated as tenant A cannot read or write tenant B's rows —
  required before that table's migration is considered complete (ties to
  `RISK_REGISTER.md` #2 and the security test list in the source brief,
  §XVIII).

## Consequences

- Every new tenant-owned table requires its own RLS policy and isolation
  test as part of the same change — no migration ships isolation as a
  follow-up.
- Background jobs and workers running under the Postgres service role
  bypass RLS by design and must carry their own explicit tenant filter in
  every query — this is a common source of leakage in RLS-based systems and
  is called out explicitly so Phase 1 code review checks for it.
