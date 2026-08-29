# DivinexAI-Infrastructure-OS

DivinexAI Infrastructure OS is the enterprise-grade AI operating system powering the DivinexAI ecosystem. It provides shared infrastructure for AI agents, payments, authentication, workflow orchestration, client deployments, analytics, and vertical business operating systems across industries.

## DMTV: Divine Media TV

DMTV is the first vertical business built on this infrastructure: an
AI-native creator ownership & commerce network (Create → Own → Publish →
Connect → Monetize → Settle). It is not a streaming clone -- the emphasis
is on creator ownership, provenance, and revenue transparency.

### Layout

- `apps/dmtv-web` -- the Next.js 16 app: creator signup/onboarding, the AI
  studio (generate → declare rights → publish), the public creator
  storefront, and the creator payout dashboard.
- `packages/dmtv-core` -- the service layer wiring the domain packages
  below to Postgres. This is what `apps/dmtv-web` calls; it has no
  framework dependency of its own.
- `packages/schemas` -- shared Zod schemas/types for every domain entity
  (organizations, creators, assets, rights, commerce, ledger, AI jobs).
- `packages/rights` -- ownership/contributor/revenue-split validation,
  and the consent gate that blocks unauthorized voice cloning or likeness
  replication.
- `packages/ai-gateway` -- the AI Provider Gateway: a vendor-agnostic
  interface for TEXT_TO_MUSIC, TEXT_TO_VIDEO, IMAGE_TO_VIDEO,
  TEXT_TO_IMAGE, VOICE, DUBBING, LYRICS, SCRIPT, THUMBNAIL, and
  SHORT_FORM_VIDEO, with credit metering and provider cost accounting. No
  AI vendor SDK is ever imported outside an `AiProvider` implementation.
- `packages/fees` -- config-driven commerce fee schedule (plan tier ->
  platform fee bps); checkout code never hard-codes a rate.
- `packages/ledger` -- append-only double-entry ledger construction:
  balanced sale/payout transactions and compensating (reversal) entries.
- `packages/flowrapay-adapter`, `packages/agentflow-adapter` -- adapter
  interfaces (plus in-memory mocks for dev/test) to FlowraPay payments and
  AgentFlow Pro orchestration. DMTV never re-implements either system --
  it only ever calls through these interfaces.
- `packages/events` -- typed domain events emitted through the AgentFlow
  Pro adapter for every significant state change.
- `packages/db` -- Postgres migrations and RLS policies enforcing
  multi-tenant isolation on every tenant-owned table. See
  `packages/db/README.md` for how to run it locally.

### Running the gates

```bash
bun install
bun run typecheck   # turbo run typecheck
bun run lint        # turbo run lint
bun run test        # turbo run test (unit; DB-dependent suites self-skip)
bun run build       # turbo run build

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/dmtv_test"
bun run db:reset             # drop/recreate/migrate the local test database
bunx turbo run test:integration   # RLS suite + the full DMTV acceptance lifecycle
```

The primary acceptance test (`packages/dmtv-core/test/lifecycle.test.ts`)
exercises the full lifecycle end-to-end against real Postgres with RLS
enabled: creator signup → onboarding → AI music + artwork generation →
asset creation → rights declaration → publication → fan registration →
purchase → platform fee calculation → creator revenue split → ledger
entry → creator balance → payout request.
