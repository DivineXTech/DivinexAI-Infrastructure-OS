# @divinexai/db

SQL migrations and RLS policies for DMTV's Postgres schema, plus a thin
`pg`-based client for running queries under the same role/claim model
Supabase uses (`anon`, `authenticated`, `service_role`, `auth.uid()`).

- `migrations/` — the real schema and RLS policies. These apply unchanged
  against a real Supabase project (Supabase already provides `auth.uid()`,
  the three roles, and their default grants).
- `local-dev/` — emulates the Supabase-provided pieces above, for local
  Postgres dev/test only. Never run against a real Supabase project.
- `src/migrate.ts` — applies `migrations/*.sql` (and, with
  `INCLUDE_LOCAL_DEV_SHIM=true`, `local-dev/*.sql` first), tracked in a
  `_migrations` table.
- `src/reset.ts` — drops and recreates the local dev/test database from
  scratch, then runs every migration. Refuses to run unless the database
  name contains `test` or `dev`.
- `src/client.ts` — `withUserContext` / `withServiceRoleContext` /
  `withAnonContext`: run a block of queries as a given Supabase role, the
  same way PostgREST would based on a request's JWT.

## Running against local Postgres

```bash
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/dmtv_test"
bun run src/reset.ts        # drop, recreate, migrate (name must contain test/dev)
bun test test/rls.test.ts   # RLS isolation tests
```

Or via the workspace script from the repo root: `bun run db:reset`.

`bun test` (no `DATABASE_URL`) skips the RLS suite rather than failing, so
`turbo run test` stays green in environments without a live Postgres.
`turbo run test:integration` requires `DATABASE_URL` and runs the real
suite; it resets and migrates the database first.
