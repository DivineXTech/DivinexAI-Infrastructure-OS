# ADR-0012: Testing Framework & Database Test Conventions

**Status:** Proposed — to be implemented starting Phase 1

## Context

The house convention review (`../HOUSE_CONVENTION_REVIEW.md`) found no
precedent to inherit here: MediaForgeOS ships no automated test suite at all
(its own `AGENTS.md` "Verification" section lists only type-checking and a
manual smoke test), and afrogrow360-core has no code. The source brief
requires unit, integration, e2e, and security tests at every phase, with
specific coverage of tenant isolation, policy evaluation, and workflow state
transitions (§XVIII) — this cannot be left unaddressed just because no
sibling repo models it.

## Decision

- **Test runner: Vitest.** TypeScript-native, fast, and shares configuration
  idioms with the Vite tooling already familiar from MediaForgeOS's frontend
  (even though AgentFlow Pro's own frontend is Next.js, not Vite) — good fit
  for a Bun/Turborepo monorepo, with a `vitest` project per `packages/*` and
  per `apps/web`.
- **Database tests** run against a real Postgres instance (a local Supabase
  stack or a plain `postgres` Docker container with the same migrations
  applied — not mocked), so RLS policies are exercised for real rather than
  simulated. Each test wraps its work in a transaction that's rolled back
  afterward (or runs against a disposable per-test schema), so tests don't
  leak state into each other.
- **Tenant-isolation tests are non-optional** for every new tenant-owned
  table (tying `ADR-0003` to a concrete, enforced practice): a table isn't
  considered done until a test proves a session authenticated as tenant A
  cannot read or write tenant B's rows in it.
- **Integration tests** exercise a package's public interface against a real
  (test-instance) Postgres, not a mocked database client, for anything RLS-
  or policy-dependent — mocking the database would hide exactly the class of
  bug (cross-tenant leakage) these tests exist to catch.
- **CI enforcement**: unlike MediaForgeOS's CI (which only builds/pushes
  Docker images), AgentFlow Pro's GitHub Actions workflow runs
  `check-types`, `lint`, and `test` on every push/PR — a gate, not just a
  build step.

## Consequences

- Every new package needs a real (even if minimal, containerized) Postgres
  available in CI — slightly more CI setup than MediaForgeOS's current
  pipeline, accepted as necessary given the brief's explicit security-testing
  requirements.
- Vitest is a new dependency with no in-org precedent; if a future need
  arises for a different runner (e.g., Playwright for true browser e2e,
  layered on top of, not replacing, Vitest for unit/integration), that's an
  additive decision, not a reversal of this one.
