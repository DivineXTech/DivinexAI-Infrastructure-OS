import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));

const AUTH_SHIM_SQL = readFileSync(
  path.join(here, "sql", "000_local_auth_shim.sql"),
  "utf8",
);

const MIGRATIONS_DIR = path.join(here, "..", "..", "..", "supabase", "migrations");

/**
 * Loads every migration in `supabase/migrations` in filename order (the same
 * timestamp-prefixed convention the Supabase CLI uses), so the test suite
 * always exercises the exact, complete set of shipped migrations rather than
 * a hand-maintained subset that could silently drift out of sync.
 */
function loadMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"));
}

/**
 * Grants mirroring Supabase's real `authenticated` role: broad CRUD grants at
 * the Postgres privilege level, with Row-Level Security policies (applied by
 * the migration itself) doing the actual per-row restriction. Without these
 * grants every query from the restricted test role would fail with a
 * permission error before RLS is even evaluated, which would prove nothing.
 */
const GRANT_AUTHENTICATED_SQL = `
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage on schema auth to authenticated;
  grant select on auth.users to authenticated;
`;

/**
 * Resets the test database to a clean slate and applies the local auth shim
 * followed by the real Phase 1 migration, so tests run against the exact SQL
 * that will ship to Supabase (plus the shim that stands in for Supabase Auth).
 * Must be run using an owner/superuser connection (e.g. `postgres`) — the
 * restricted `authenticated` role used by `asUser` cannot create schemas.
 */
export async function resetAndMigrate(pool: Pool): Promise<void> {
  await pool.query("drop schema if exists auth cascade");
  await pool.query("drop schema public cascade");
  await pool.query("create schema public");
  await pool.query(AUTH_SHIM_SQL);
  for (const migration of loadMigrations()) {
    await pool.query(migration);
  }
  await pool.query(GRANT_AUTHENTICATED_SQL);
}

/**
 * Runs `fn` with the Postgres session set up to look, from RLS's
 * perspective, like a request authenticated as `userId` — mirroring what
 * PostgREST does per-request in real Supabase. Uses a dedicated client (not
 * the pool directly) so the setting doesn't leak onto a connection another
 * concurrent query might reuse.
 */
export async function asUser<T>(
  pool: Pool,
  userId: string | null,
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [
      userId ?? "",
    ]);
    return await fn(client);
  } finally {
    client.release();
  }
}
