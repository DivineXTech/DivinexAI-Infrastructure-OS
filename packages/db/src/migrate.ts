import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, "migrations");
const LOCAL_DEV_DIR = path.join(PACKAGE_ROOT, "local-dev");

async function sqlFilesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

/**
 * Applies migrations/*.sql (the schema + RLS policies that also apply
 * unchanged to a real Supabase project) against DATABASE_URL, tracking
 * what has already run in a `_migrations` table. When INCLUDE_LOCAL_DEV_SHIM
 * is set, first (re-)applies local-dev/*.sql, which emulates the
 * auth.uid()/role/grants a real Supabase project already provides -- used
 * only for local Postgres dev and CI, never against Supabase itself.
 */
export async function runMigrations(databaseUrl: string, includeLocalDevShim: boolean): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    if (includeLocalDevShim) {
      const localDevFiles = await sqlFilesIn(LOCAL_DEV_DIR);
      for (const file of localDevFiles) {
        const sql = await readFile(path.join(LOCAL_DEV_DIR, file), "utf8");
        await pool.query(sql);
        console.log(`[local-dev shim] applied ${file}`);
      }
    }

    await pool.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const { rows } = await pool.query<{ name: string }>("select name from _migrations");
    const applied = new Set(rows.map((r) => r.name));

    const files = await sqlFilesIn(MIGRATIONS_DIR);
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const includeLocalDevShim = process.env.INCLUDE_LOCAL_DEV_SHIM === "true";
  await runMigrations(databaseUrl, includeLocalDevShim);
  console.log("Migrations complete.");
}
