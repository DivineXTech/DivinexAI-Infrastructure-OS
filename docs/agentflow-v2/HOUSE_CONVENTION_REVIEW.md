# House Convention Review

Read-only inspection of `DivineXTech/-MediaForgeOS` and `DivineXTech/afrogrow360-core`,
performed to check whether an existing DivineXTech production convention should
override the stack recommendation in `ADR-0001` before Phase 1 starts writing
code. `africaone-landing` was deliberately excluded as a primary reference
(landing-site codebase, not a production application).

Precedence applied, as directed:

1. AgentFlow Pro's own existing repository conventions
2. MediaForgeOS production conventions
3. afrogrow360-core shared/runtime conventions
4. Documented DivinexAI standards
5. New conventions only where none already exist

## What was inspected

**`DivineXTech/-MediaForgeOS`** ("Video Arena") — a real, current production
app (latest commit: "Add superadmin role..."). Bun-managed Turborepo monorepo,
`apps/frontend` (Vite + React 19 + React Router 7 + Tailwind v4 + Radix UI),
`apps/backend` (Express + TypeScript, run directly via `bun`, no build step),
`packages/db` (Prisma + Postgres), `packages/eslint-config` /
`packages/typescript-config` (shared tooling). Auth via `better-auth`
(email/password + Google), Postgres + MinIO self-hosted via Docker Compose in
dev, deployed as Docker images built by GitHub Actions and rolled out to
Kubernetes via `kubectl`/ArgoCD. `AGENTS.md` documents conventions explicitly
and is the single best source found for house engineering practice.

Crucially, MediaForgeOS is a **single-tenant, consumer-facing (B2C) app** —
its `schema.prisma` has no tenant, organization, or membership model at all,
just `User` (`Session`/`Account`/`Verification` for better-auth) with a plain
`role: String` field and an env-var email allowlist (`ADMIN_EMAILS`,
`SUPERADMIN_EMAILS`) for admin promotion. There is no RLS — Postgres is
accessed directly via Prisma with app-level `userId` filtering. There is also
no automated test suite (`AGENTS.md`'s own "Verification" section lists only
`check-types`, `build`, and a manual smoke test — no unit/integration tests).

**`DivineXTech/afrogrow360-core`** — greenfield, one commit, README only
("Next.js-based AI-powered app & website builder... FinTech-ready
architecture"). No code to inspect. Its README is the only signal it offers:
a stated intent to use Next.js for that product, which is weighed below as a
weak, documented-standard-tier signal, not a concrete convention.

## Conventions adopted

| Convention                                                                                                                      | Source       | Reason                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Package manager: **Bun**                                                                                                        | MediaForgeOS | Clear, current, real production choice (`packageManager: bun@1.3.11`); no AgentFlow Pro convention existed to conflict with it |
| Monorepo tool: **Turborepo**, `apps/*` + `packages/*` workspaces                                                                | MediaForgeOS | Same reasoning; compatible with the `packages/*`-per-module layout already proposed in `IMPLEMENTATION_PLAN.md`                |
| Validation library: **Zod**                                                                                                     | MediaForgeOS | Matches an unresolved gap in the original plan; also the natural fit for the brief's schema-validated tool/agent inputs        |
| Env var convention: single Zod-validated `env.ts` per app/package, `.env.example` with inline comments at repo root and per app | MediaForgeOS | Concrete, well-documented pattern (`apps/backend/src/env.ts`) worth reusing verbatim                                           |
| Shared lint/type-check tooling as its own workspace packages (`@repo/eslint-config`, `@repo/typescript-config`)                 | MediaForgeOS | Directly reusable pattern for a `packages/*`-heavy monorepo                                                                    |
| CI tool: **GitHub Actions**                                                                                                     | MediaForgeOS | Confirmed as the house CI platform (`.github/workflows/deploy.yml`), independent of what it deploys to                         |

## Conventions rejected

| Convention                                                                          | Source       | Reason for rejection                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework: Vite + React SPA                                                | MediaForgeOS | AgentFlow Pro's own stack (ADR-0001, already approved) specifies Next.js — a tier-1 decision, which outranks a tier-2 sibling-repo convention. Reinforced, weakly, by afrogrow360-core's README stating a Next.js intent for its own product (tier-4 signal, consistent direction)       |
| Backend framework: Express                                                          | MediaForgeOS | Superseded by Next.js API routes/route handlers under the already-approved stack                                                                                                                                                                                                         |
| Auth: better-auth (self-hosted)                                                     | MediaForgeOS | AgentFlow Pro's stack already commits to Supabase Auth (ADR-0001) for its bundled RLS integration — a tier-1 decision                                                                                                                                                                    |
| ORM: Prisma                                                                         | MediaForgeOS | AgentFlow Pro's RLS-centric tenant isolation model (ADR-0003) is built on Postgres-native RLS policies applied via SQL migrations; Prisma has no first-class RLS policy management and would fight that model. Supabase's own migration CLI (raw SQL, timestamped files) is kept instead |
| Object storage: MinIO (self-hosted)                                                 | MediaForgeOS | Supabase Storage already covered by the approved stack; no reason to add a second storage vendor                                                                                                                                                                                         |
| Uncommitted / dev-push-only migrations (no `prisma/migrations` history in the repo) | MediaForgeOS | Conflicts directly with the source brief's requirement for versioned, reversible migrations with documented rollback instructions per phase                                                                                                                                              |
| Deploy target: Docker images → Kubernetes/ArgoCD                                    | MediaForgeOS | Superseded by the user's explicit current working assumption (Vercel + Supabase); see `ADR-0011`                                                                                                                                                                                         |

## Conflicts found

- **Database/auth/ORM stack** — MediaForgeOS's real, current production choice
  (Prisma + self-hosted Postgres + better-auth + MinIO) directly conflicts
  with AgentFlow Pro's already-approved stack (Supabase Postgres + Supabase
  Auth + Supabase Storage, `ADR-0001`). Resolved in favor of the tier-1
  decision — it was made specifically for AgentFlow Pro and reaffirmed
  explicitly by the user in the same message that requested this review.
- **Deployment target** — MediaForgeOS deploys to Kubernetes; the user's
  explicit working assumption for AgentFlow Pro is Vercel for the web app/
  short-lived API workloads. Resolved the same way: explicit, current,
  tier-1 instruction wins. Recorded in the new `ADR-0011`.
- **Test coverage philosophy** — MediaForgeOS ships with no automated test
  suite; the source brief for AgentFlow Pro requires unit/integration/e2e/
  security tests per phase. Not really a "conflict" to resolve so much as a
  gap neither sibling repo fills — see "New conventions" below.

## New conventions established (no house precedent existed)

- **Multi-tenant schema and RLS pattern** (`tenants`, `tenant_memberships`,
  RLS policy template) — neither sibling repo has any tenant/membership
  concept to inherit from (MediaForgeOS is single-tenant B2C; afrogrow360-core
  has no code). `ADR-0003` stands as originally proposed.
- **Test framework and database test approach** — no precedent in either
  repo. New `ADR-0012` picks Vitest + a dedicated test-schema/transaction-
  rollback approach for database tests, detailed there.
- **Durable worker hosting** — no precedent (MediaForgeOS's Kubernetes
  deployment was rejected above). New `ADR-0011` records the current Vercel +
  Supabase working assumption and compares worker-hosting options, decision
  explicitly deferred to before Phase 5.

## ADR updates required

- `ADR-0001` (stack selection) — updated in place to record the adopted
  tooling conventions (Bun, Turborepo, Zod, env-var pattern) and the rejected
  MediaForgeOS conventions with rationale.
- `ADR-0011-deployment-topology-and-worker-hosting.md` — new, per this
  review and the user's explicit instruction.
- `ADR-0012-testing-framework.md` — new, filling the gap neither sibling repo
  addressed.
- `ADR-0004` (workflow runtime) — cross-reference added to `ADR-0011` (the
  execution-model decision and the hosting decision are related but
  separable).

## Final convention set for AgentFlow Pro (summary)

TypeScript, Bun package manager, Turborepo monorepo (`apps/*` + `packages/*`),
Next.js (App Router) for the web app, Supabase (Postgres + RLS + Auth +
Storage + pgvector) for data/auth/storage, raw SQL migrations via the
Supabase CLI, Zod for validation, a shared Zod-validated `env.ts` per app/
package, GitHub Actions for CI, Vercel for the web app and short-lived API
workloads with the durable worker's hosting decision deferred to before
Phase 5 (`ADR-0011`), and Vitest for testing (`ADR-0012`).
