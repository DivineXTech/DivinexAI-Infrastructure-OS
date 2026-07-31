import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";

/**
 * Self-contained copy of packages/shared/test/setupTestDb.ts's harness — a
 * cross-package relative import would violate tsc's `rootDir` constraint
 * for this package, so this small (test-only) file is duplicated rather
 * than imported. Keep the two in sync if the harness itself changes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

const AUTH_SHIM_SQL = readFileSync(
  path.join(here, "sql", "000_local_auth_shim.sql"),
  "utf8",
);

const MIGRATIONS_DIR = path.join(
  here,
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
);

function loadMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"));
}

const GRANT_AUTHENTICATED_SQL = `
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage on schema auth to authenticated;
  grant select on auth.users to authenticated;
`;

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

export async function asUser<T>(
  pool: Pool,
  userId: string | null,
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [userId ?? ""],
    );
    return await fn(client);
  } finally {
    client.release();
  }
}
