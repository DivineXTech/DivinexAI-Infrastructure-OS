import { Pool } from "pg";
import { runMigrations } from "./migrate";

/**
 * Drops and recreates the public/auth/app schemas, then re-runs every
 * migration from scratch. Local dev/test only -- refuses to run unless the
 * database name contains "test" or "dev", as a guard against pointing this
 * at a real environment by accident.
 */
async function reset(databaseUrl: string): Promise<void> {
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!/test|dev/i.test(dbName)) {
    throw new Error(
      `Refusing to reset database "${dbName}": db:reset only runs against a database whose name contains "test" or "dev".`,
    );
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("drop schema if exists public cascade");
    await pool.query("create schema public");
    await pool.query("drop schema if exists auth cascade");
    await pool.query("drop schema if exists app cascade");
  } finally {
    await pool.end();
  }
  await runMigrations(databaseUrl, true);
}

if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  await reset(databaseUrl);
  console.log("Database reset and migrated.");
}
