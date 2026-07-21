/**
 * Minimal structural interface satisfied by both `pg.Pool` and
 * `pg.PoolClient` — the services in this package take one of these rather
 * than a concrete `pg` type, so callers can pass a pooled connection or a
 * single checked-out client (e.g. inside a transaction) interchangeably.
 *
 * These services connect directly to Postgres rather than through
 * `@supabase/supabase-js`/PostgREST — Supabase supports this natively (it
 * gives every project a direct Postgres connection string alongside the
 * PostgREST data API), and it is what this repository can actually exercise
 * against real Row-Level Security in this environment (see
 * `docs/agentflow-v2/PHASE_1_TENANCY.md` and
 * `docs/agentflow-v2/PHASE_1_SUPABASE_VALIDATION.md`). `tenant.ts`'s
 * `assertTenantMembership`/`assertTenantPermission` remain the
 * `@supabase/supabase-js`-based entry points for Next.js route-handler
 * contexts using a user-scoped client; both enforce the same underlying
 * schema and RLS policies.
 */
export interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
}
