# KushPrintCo OS™

KushPrintCo OS is a white-label apparel business launch and operations
platform — brand creation, design studio, production, storefront, and
operations in one system. It is one of the vertical business operating
systems built on **DivinexAI Infrastructure OS**, the enterprise-grade AI
operating system providing shared infrastructure for AI agents, payments,
authentication, workflow orchestration, client deployments, and analytics
across the DivinexAI ecosystem.

Primary promise: *"Launch Your Clothing Brand. We Supply Everything."*

## Status

Phase 1 (Foundation) complete: authentication, tenant/membership/role model
with Row-Level Security, the app/admin shells, and the service
abstractions payments and DivinexAI integrations will plug into. See
`docs/ROADMAP.md` for what's next and `docs/IMPLEMENTATION_PLAN.md` for the
full build sequence.

## Getting started

```bash
cp .env.example .env.local   # fill in real Supabase values, or use the
                              # placeholders already in .env.local for a
                              # build/typecheck-only workflow
npm install
npm run dev
```

Open <http://localhost:3000>.

### Local database

```bash
supabase start
supabase db reset   # applies supabase/migrations/ + supabase/seed/seed.sql
npm run seed        # creates demo auth users (dev-only, see scripts/seed.ts)
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run seed` | Seed dev-only demo accounts (never run against production) |

## Documentation

- `docs/CURRENT_STATE.md` — repository audit (Phase 0)
- `docs/IMPLEMENTATION_PLAN.md` — route map, database model, phase plan
- `docs/ARCHITECTURE.md` — stack, execution contexts, directory layout
- `docs/DATABASE.md` — schema conventions, migrations, seeding
- `docs/SECURITY.md` — tenant isolation, RLS, secrets handling
- `docs/ROLES_AND_PERMISSIONS.md` — role model and where checks live
- `docs/PAYMENTS.md` — provider-neutral payments abstraction
- `docs/DIVINEXAI_INTEGRATION.md` — DivinexAI service interfaces
- `docs/WHITE_LABEL.md` — white-label plan (not yet built)
- `docs/DEPLOYMENT.md` — environment variables, deploy checklist
- `docs/TESTING.md` — how to run and extend the test suite
- `docs/ROADMAP.md` — phase status and next recommended phase
